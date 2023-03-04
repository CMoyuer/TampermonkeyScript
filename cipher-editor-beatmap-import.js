// ==UserScript==
// @name         闪韵灵镜铺面导入
// @namespace    cipher-editor-beatmap-import
// @version      1.0.2
// @description  通过BeatSaver导入铺面
// @author       如梦Nya
// @license      MIT
// @run-at       document-start
// @grant        unsafeWindow
// @match        https://cipher-editor-cn.picovr.com/*
// @icon         https://cipher-editor-cn.picovr.com/assets/logo-eabc5412.png
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

const $ = window.jQuery

// ================================================================================ 工具类 ================================================================================

/**
 * 数据库操作类
 */
class WebDB {
    constructor() {
        this.db = undefined
    }

    /**
     * 打开数据库
     * @param {string} dbName 数据库名
     * @param {number | undefined} dbVersion 数据库版本
     * @returns 
     */
    open(dbName, dbVersion) {
        let self = this
        return new Promise(function (resolve, reject) {
            const indexDB = unsafeWindow.indexedDB || unsafeWindow.webkitIndexedDB || unsafeWindow.mozIndexedDB
            let req = indexDB.open(dbName, dbVersion)
            req.onerror = reject
            req.onsuccess = function (e) {
                self.db = e.target.result
                resolve(self)
            }
        });
    }

    /**
     * 查出一条数据
     * @param {string} tableName 表名
     * @param {string} key 键名
     * @returns 
     */
    get(tableName, key) {
        let self = this
        return new Promise(function (resolve, reject) {
            let req = self.db.transaction([tableName]).objectStore(tableName).get(key)
            req.onerror = reject
            req.onsuccess = function (e) {
                resolve(e.target.result)
            }
        });
    }

    /**
     * 插入、更新一条数据
     * @param {string} tableName 表名
     * @param {string} key 键名
     * @param {any} value 数据
     * @returns 
     */
    put(tableName, key, value) {
        let self = this
        return new Promise(function (resolve, reject) {
            let req = self.db.transaction([tableName], 'readwrite').objectStore(tableName).put(value, key)
            req.onerror = reject
            req.onsuccess = function (e) {
                resolve(e.target.result)
            }
        });
    }

    /**
     * 关闭数据库
     */
    close() {
        this.db.close()
        delete this.db
    }
}


/**
 * 闪韵灵镜工具类
 */
class CipherUtils {
    /**
     * 获取当前谱面的信息
     */
    static getNowBeatmapInfo() {
        let url = location.href
        // ID
        let matchId = url.match(/id=(\w*)/)
        let id = matchId ? matchId[1] : ""
        // BeatSaverID
        let beatsaverId = "*"
        let nameBoxList = $(".css-tpsa02")
        if (nameBoxList.length > 0) {
            let name = nameBoxList[0].innerHTML
            let matchBeatsaverId = name.match(/\[(\w*)\]/)
            if (matchBeatsaverId) beatsaverId = matchBeatsaverId[1]
        }
        // 难度
        let matchDifficulty = url.match(/difficulty=(\w*)/)
        let difficulty = matchDifficulty ? matchDifficulty[1] : ""
        return { id, difficulty, beatsaverId }
    }
}


/**
 * BeatSaver工具类
 */
class BeatSaverUtils {
    /**
     * 获取压缩包下载链接
     * @param {string} id 歌曲ID
     * @return {Promise}
     */
    static getDownloadUrl(id) {
        return new Promise(function (resolve, reject) {
            $.get("https://beatsaver.com/api/maps/id/" + id, (data, status) => {
                if (status != "success") {
                    reject(status)
                    return
                }
                resolve(data.versions[0].downloadURL)
            })
        })
    }

    /**
     * 从BeatSaver下载ogg文件
     * @param {number} zipUrl 歌曲压缩包链接
     * @param {function | undefined} onprogress 进度回调
     * @returns {Promise}
     */
    static downloadSongFile(zipUrl, onprogress) {
        return new Promise(function (resolve, reject) {
            let xhr = new XMLHttpRequest()
            xhr.open('GET', zipUrl, true)
            xhr.responseType = "blob"
            xhr.onprogress = onprogress
            xhr.onload = function () {
                if (this.status !== 200) {
                    reject("http code:" + this.status)
                    return
                }
                resolve(new Blob([this.response], { type: "application/zip" }))
            }
            xhr.onerror = reject
            xhr.send()
        })
    }

    /**
     * 从压缩包中提取出曲谱配置
     * @param {blob} zipBlob 
     * @returns 
     */
    static async getBeatmapInfoFromZip(zipBlob) {
        let zip = await unsafeWindow.JSZip.loadAsync(zipBlob)
        let beatmapInfo = {}
        for (let fileName in zip.files) {
            if (!fileName.endsWith("Standard.dat")) continue
            let str = await zip.file(fileName).async("string")
            beatmapInfo[fileName.replace("Standard.dat", "")] = JSON.parse(str)
        }
        return beatmapInfo
    }
}

/**
 * 通用工具类
 */
class Utils {
    /**
     * 动态添加Script
     * @param {string} url 脚本链接
     * @param {string} scriptId 脚本唯一ID
     * @returns 
     */
    static dynamicLoadJs(url, scriptId) {
        return new Promise(function (resolve, reject) {
            // 判断之前有没有添加过
            if (scriptId) {
                let scripts = $("#" + scriptId)
                if (scripts.length > 0) {
                    let script = scripts[0]
                    if (!script.readyState || script.readyState === "loaded" || script.readyState === "complete") {
                        resolve()
                    } else {
                        script.onload = script.onreadystatechange = function () {
                            if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                                resolve()
                                script.onload = script.onreadystatechange = null
                            }
                        }
                    }
                    return
                }
            }
            // 没有就添加
            {
                let script = document.createElement('script')
                script.type = 'text/javascript'
                script.src = url
                if (scriptId) script.id = scriptId
                script.onload = script.onreadystatechange = function () {
                    if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                        resolve()
                        script.onload = script.onreadystatechange = null
                    }
                }
                $("head")[0].appendChild(script)
            }
        });
    }
}

// ================================================================================ 方法 ================================================================================


/**
 * 在顶部菜单添加导入按钮
 */
function addImportButton() {
    if ($("#importBeatmap").length > 0) return
    let btnsBoxList = $(".css-4e93fo")
    if (btnsBoxList.length == 0) return
    let btnImport = $(btnsBoxList[0].childNodes[0]).clone()[0]
    btnImport.id = "importBeatmap"
    btnImport.innerHTML = "从BeatSaver导入节拍"
    btnImport.onclick = importFromBeatSaver
    btnsBoxList[0].prepend(btnImport)
}

async function importFromBeatSaver() {
    let BLITZ_RHYTHM_files = await new WebDB().open("BLITZ_RHYTHM-files")
    try {
        // 获取当前谱面信息
        let nowBeatmapInfo = CipherUtils.getNowBeatmapInfo()
        let datKey = nowBeatmapInfo.id + "_" + nowBeatmapInfo.difficulty + "_Ring.dat"
        let datStr = await BLITZ_RHYTHM_files.get("keyvaluepairs", datKey)
        let datInfo = JSON.parse(datStr)
        if (datInfo._version !== "2.3.0") {
            alert("插件不支持该谱面版本！可尝试重新创建谱面")
            return
        }

        // 获取谱面信息
        let beatmapInfo = {}
        {
            let url = prompt('请输入BeatSaver铺面链接', "https://beatsaver.com/maps/" + nowBeatmapInfo.beatsaverId)
            if (!url) return
            let result = url.match(/^https:\/\/beatsaver.com\/maps\/(\S*)$/)
            if (!result) {
                alert("链接格式错误！")
                return
            }
            let downloadUrl = await BeatSaverUtils.getDownloadUrl(result[1])
            let zipBlob = await BeatSaverUtils.downloadSongFile(downloadUrl)
            beatmapInfo = await BeatSaverUtils.getBeatmapInfoFromZip(zipBlob)
        }
        // 选择导入难度
        let tarDifficulty = ""
        {
            let defaultDifficulty = ""
            let promptTip = ""
            let difficultyList = []
            for (let diff in beatmapInfo) {
                difficultyList.push(diff)
                if (!defaultDifficulty) {
                    defaultDifficulty = diff
                } else {
                    promptTip += "、"
                }
                promptTip += diff
            }
            while (true) {
                tarDifficulty = prompt("请输入要导入的难度（注意大小写）：" + promptTip, defaultDifficulty)
                if (!tarDifficulty) return
                if (difficultyList.indexOf(tarDifficulty) >= 0) {
                    break
                }
                alert("请从以下难度中选择一个：" + promptTip)
            }
        }
        // 开始导入
        let changeInfo = analyseBeatMapInfo(beatmapInfo[tarDifficulty])
        datInfo._notes = changeInfo._notes
        await BLITZ_RHYTHM_files.put("keyvaluepairs", datKey, JSON.stringify(datInfo))
        window.location.reload()
    } catch (error) {
        throw error
    } finally {
        BLITZ_RHYTHM_files.close()
    }
}


/**
 * 处理BeatSaber谱面信息
 * @param {JSON} info 
 */
function analyseBeatMapInfo(rawInfo) {
    let info = {
        _notes: [], // 音符
    }
    let beatmapVersion = rawInfo._version
    if (beatmapVersion.startsWith("3.")) {
        for (let index in rawInfo.colorNotes) {
            let rawNote = rawInfo.colorNotes[index]
            info._notes.push({
                _time: rawNote.b,
                _lineIndex: rawNote.x,
                _lineLayer: rawNote.y,
                _type: rawNote.c,
                _cutDirection: 8,
            })
        }
    } else if (beatmapVersion.startsWith("2.")) {
        for (let index in rawInfo._notes) {
            let rawNote = rawInfo._notes[index]
            info._notes.push({
                _time: rawNote._time,
                _lineIndex: rawNote._lineIndex,
                _lineLayer: rawNote._lineLayer,
                _type: rawNote._type,
                _cutDirection: 8,
            })
        }
    } else {
        alert("暂不支持该谱面的版本（" + beatmapVersion + "），请换个链接再试！")
    }
    return info
}

// ================================================================================ 入口 ================================================================================

// 主入口
(function () {
    'use strict'

    Utils.dynamicLoadJs("https://cdn.bootcdn.net/ajax/libs/jszip/3.10.1/jszip.min.js", "jszip").then(() => {
        setInterval(() => {
            addImportButton()
        }, 1000)
    })
})()