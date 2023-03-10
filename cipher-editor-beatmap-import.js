// ==UserScript==
// @name         闪韵灵镜铺面导入
// @namespace    cipher-editor-beatmap-import
// @version      1.1.3
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

    /**
     * 关闭编辑器顶部菜单
     */
    static closeEditorTopMenu() {
        $(".css-7vvr1").click()
    }

    /**
     * 显示Loading
     */
    static showLoading() {
        $("main").append('<div class="css-c81162"><span class="MuiCircularProgress-root MuiCircularProgress-indeterminate MuiCircularProgress-colorPrimary css-11gk5wa" role="progressbar" style="width: 40px; height: 40px;"><svg class="MuiCircularProgress-svg css-13o7eu2" viewBox="22 22 44 44"><circle class="MuiCircularProgress-circle MuiCircularProgress-circleIndeterminate css-14891ef" cx="44" cy="44" r="20.2" fill="none" stroke-width="3.6"></circle></svg></span></div>')
    }

    /**
     * 隐藏Loading
     */
    static hideLoading() {
        $(".css-c81162").remove()
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
            $.ajax({
                url: "https://beatsaver.com/api/maps/id/" + id,
                type: "get",
                success: (data) => {
                    resolve(data.versions[0].downloadURL)
                },
                error: (req, status, err) => {
                    reject(req.status + " " + req.responseJSON.error)
                }
            })
        })
    }

    /**
     * 从压缩包中提取曲谱难度文件
     * @param {Blob} zipBlob
     * @returns 
     */
    static async getBeatmapInfo(zipBlob) {
        let zip = await unsafeWindow.JSZip.loadAsync(zipBlob)
        // 谱面信息
        let infoFile
        for (let fileName in zip.files) {
            if (fileName.toLowerCase() !== "info.dat") continue
            infoFile = zip.files[fileName]
            break
        }
        let rawBeatmapInfo = JSON.parse(await infoFile.async("string"))
        // 难度列表
        let difficultyBeatmaps
        let diffBeatmapSets = rawBeatmapInfo._difficultyBeatmapSets
        for (let a in diffBeatmapSets) {
            let info = diffBeatmapSets[a]
            if (info["_beatmapCharacteristicName"] !== "Standard") continue
            difficultyBeatmaps = info._difficultyBeatmaps
            break
        }
        // 难度对应文件名
        let beatmapInfo = {
            version: rawBeatmapInfo._version,
            difficulties: [],
            files: {}
        }
        for (let index in difficultyBeatmaps) {
            let difficultyInfo = difficultyBeatmaps[index]
            let diffName = difficultyInfo._difficulty
            if (difficultyInfo._customData && difficultyInfo._customData._difficultyLabel)
                diffName = difficultyInfo._customData._difficultyLabel
            beatmapInfo.difficulties.push(diffName)
            beatmapInfo.files[diffName] = zip.files[difficultyInfo._beatmapFilename]
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
    /**
     * 下载压缩包文件
     * @param {number} zipUrl 歌曲压缩包链接
     * @param {function | undefined} onprogress 进度回调
     * @returns {Promise}
     */
    static downloadZipFile(zipUrl, onprogress) {
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
    btnImport.innerHTML = "从BeatSaver导入谱面"
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
            CipherUtils.showLoading()
            let downloadUrl = await BeatSaverUtils.getDownloadUrl(result[1])
            let zipBlob = await Utils.downloadZipFile(downloadUrl)
            beatmapInfo = await BeatSaverUtils.getBeatmapInfo(zipBlob)
            CipherUtils.hideLoading()
            if (beatmapInfo.difficulties.length == 0) {
                alert("该谱面找不到可用的难度")
                return
            }
        }
        // 选择导入难度
        let tarDifficulty = 1
        {
            let defaultDifficulty = "1"
            let promptTip = ""
            for (let index in beatmapInfo.difficulties) {
                if (index > 0) promptTip += "、"
                promptTip += beatmapInfo.difficulties[index]
            }
            let difficulty = ""
            while (true) {
                difficulty = prompt("请问要导入第几个难度（数字）：" + promptTip, defaultDifficulty)
                if (!difficulty) return // Cancel
                if (/^\d$/.test(difficulty)) {
                    tarDifficulty = parseInt(difficulty)
                    if (tarDifficulty > 0 && tarDifficulty <= beatmapInfo.difficulties.length) break
                    alert("请输入准确的序号！")
                } else {
                    alert("请输入准确的序号！")
                }
            }
        }
        // 开始导入
        CipherUtils.showLoading()
        let beatmapInfoStr = await beatmapInfo.files[beatmapInfo.difficulties[tarDifficulty - 1]].async("string")
        let changeInfo = convertBeatMapInfo(beatmapInfo.version, JSON.parse(beatmapInfoStr))
        datInfo._notes = changeInfo._notes
        datInfo._obstacles = changeInfo._obstacles
        await BLITZ_RHYTHM_files.put("keyvaluepairs", datKey, JSON.stringify(datInfo))
        // 导入完成
        setTimeout(() => {
            CipherUtils.closeEditorTopMenu()
            window.location.reload()
        }, 1000)
    } catch (err) {
        console.error(err)
        alert("出错啦：" + err)
        CipherUtils.hideLoading()
    } finally {
        BLITZ_RHYTHM_files.close()
    }
}


/**
 * 转换BeatSaber谱面信息
 * @param {string} version
 * @param {JSON} info 
 */
function convertBeatMapInfo(version, rawInfo) {
    let info = {
        _notes: [], // 音符
        _obstacles: [], // 墙
    }
    if (version.startsWith("3.")) {
        // 音符
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
    } else if (version.startsWith("2.")) {
        // 音符
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
        // 墙
        for (let index in rawInfo._obstacles) {
            let rawNote = rawInfo._obstacles[index]
            info._obstacles.push({
                _time: rawNote._time,
                _duration: rawNote._duration,
                _type: rawNote._type,
                _lineIndex: rawNote._lineIndex,
                _width: rawNote._width,
            })
        }
    } else {
        throw ("暂不支持该谱面的版本（" + version + "），请换个链接再试！")
    }
    // 因Cipher不支持长墙，所以转为多面墙
    let newObstacles = []
    for (let index in info._obstacles) {
        let baseInfo = info._obstacles[index]
        let startTime = baseInfo._time
        let endTime = baseInfo._time + baseInfo._duration
        let duration = baseInfo._duration
        baseInfo._duration = 0.04
        // 头
        baseInfo._time = startTime
        newObstacles.push(JSON.parse(JSON.stringify(baseInfo)))
        // 中间
        let count = Math.floor(duration / 1) - 2  // 至少间隔1秒
        let dtime = ((endTime - 0.04) - (startTime + 0.04)) / count
        for (let i = 0; i < count; i++) {
            baseInfo._time += dtime
            newObstacles.push(JSON.parse(JSON.stringify(baseInfo)))
        }
        // 尾
        baseInfo._time = endTime - 0.04
        newObstacles.push(JSON.parse(JSON.stringify(baseInfo)))
    }
    info._obstacles = newObstacles
    return info
}

// ================================================================================ 入口 ================================================================================

// 主入口
(function () {
    'use strict'

    Utils.dynamicLoadJs("https://cmoyuer.gitee.io/my-resources/js/jszip.min.js", "jszip").then(() => {
        setInterval(() => {
            addImportButton()
        }, 1000)
    })
})()