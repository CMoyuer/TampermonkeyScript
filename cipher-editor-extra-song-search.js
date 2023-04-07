// ==UserScript==
// @name         闪韵灵镜歌曲搜索扩展
// @namespace    cipher-editor-extra-song-search
// @version      1.4
// @description  通过BeatSaver方便添加歌曲
// @author       如梦Nya
// @license      MIT
// @run-at       document-body
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
     * 处理歌曲文件
     * @param {ArrayBuffer} rawBuffer 
     * @returns 
     */
    static applySongFile(rawBuffer) {
        // 前面追加数据，以通过校验
        let rawData = new Uint8Array(rawBuffer)
        let BYTE_VERIFY_ARRAY = [235, 186, 174, 235, 186, 174, 235, 186, 174, 85, 85]

        let buffer = new ArrayBuffer(rawData.length + BYTE_VERIFY_ARRAY.length)
        let dataView = new DataView(buffer)
        for (let i = 0; i < BYTE_VERIFY_ARRAY.length; i++) {
            dataView.setUint8(i, BYTE_VERIFY_ARRAY[i])
        }
        for (let i = 0; i < rawData.length; i++) {
            dataView.setUint8(BYTE_VERIFY_ARRAY.length + i, rawData[i])
        }
        return new Blob([buffer], { type: "application/octet-stream" })
    }
}

/**
 * 通用工具类
 */
class Utils {
    /** @type {HTMLIFrameElement | undefined} */
    static _sandBoxIframe = undefined

    /**
     * 创建一个Iframe沙盒
     * @returns {Document}
     */
    static getSandbox() {
        if (!Utils._sandBoxIframe) {
            let id = GM_info.script.namespace + "_iframe"

            // 找ID
            let iframes = $('#' + id)
            if (iframes.length > 0) Utils._sandBoxIframe = iframes[0]

            // 不存在，创建一个
            if (!Utils._sandBoxIframe) {
                let ifr = document.createElement("iframe");
                ifr.id = id
                ifr.style.display = "none"
                document.body.appendChild(ifr);
                Utils._sandBoxIframe = ifr;
            }
        }
        return Utils._sandBoxIframe
    }

    /**
     * 动态添加Script
     * @param {string} url 脚本链接
     * @returns 
     */
    static dynamicLoadJs(url) {
        return new Promise(function (resolve, reject) {
            let ifrdoc = Utils.getSandbox().contentDocument;
            let script = ifrdoc.createElement('script')
            script.type = 'text/javascript'
            script.src = url
            script.onload = script.onreadystatechange = function () {
                if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                    resolve()
                    script.onload = script.onreadystatechange = null
                }
            }
            ifrdoc.body.appendChild(script)
        });
    }
}

/**
 * BeatSaver工具类
 */
class BeatSaverUtils {
    /**
     * 搜索歌曲列表
     * @param {string} searchKey 搜索关键字
     * @param {number} pageCount 搜索页数
     * @returns 
     */
    static searchSongList(searchKey, pageCount = 1) {
        return new Promise(function (resolve, reject) {
            let songList = []
            let songInfoMap = {}
            let count = 0
            let cbFlag = false
            let func = (data, status) => {
                if (status !== "success") {
                    if (!cbFlag) {
                        cbFlag = true
                        reject("访问BeatSaver时发生错误！")
                    }
                    return
                }
                // 填充数据
                data.docs.forEach(rawInfo => {
                    let artist = rawInfo.metadata.songAuthorName
                    let bpm = rawInfo.metadata.bpm
                    let cover = rawInfo.versions[0].coverURL
                    let song_name = "[" + rawInfo.id + "]" + rawInfo.metadata.songName
                    let id = 80000000000 + parseInt(rawInfo.id, 36)
                    songList.push({ artist, bpm, cover, song_name, id })

                    let downloadURL = rawInfo.versions[0].downloadURL
                    let previewURL = rawInfo.versions[0].previewURL
                    songInfoMap[id] = { downloadURL, previewURL }
                })
                if (++count == pageCount) {
                    cbFlag = true
                    resolve({ songList, songInfoMap })
                }
            }
            for (let i = 0; i < pageCount; i++) {
                $.get("https://beatsaver.com/api/search/text/" + i + "?sortOrder=Relevance&q=" + searchKey, func)
            }
        })
    }


    /**
     * 从BeatSaver下载ogg文件
     * @param {number} zipUrl 歌曲压缩包链接
     * @param {function} onprogress 进度回调
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
                let blob = new Blob([this.response], { type: "application/zip" })
                // 解压出ogg文件
                BeatSaverUtils.getOggFromZip(blob).then(oggBlob => {
                    resolve(oggBlob)
                }).catch(reject)
            }
            xhr.onerror = reject
            xhr.send()
        })
    }

    /**
     * 从压缩包中提取出ogg文件
     * @param {blob} zipBlob 
     * @returns 
     */
    static async getOggFromZip(zipBlob) {
        let zip = await unsafeWindow.JSZip.loadAsync(zipBlob)
        let eggFile = undefined
        for (let fileName in zip.files) {
            if (!fileName.endsWith(".egg")) continue
            eggFile = zip.file(fileName)
            break
        }
        let rawBuffer = await eggFile.async("arraybuffer")
        return CipherUtils.applySongFile(rawBuffer)
    }
}

/**
 * XMLHttpRequest请求拦截器
 */
class XHRIntercept {
    /** @type {XHRIntercept} */
    static _self

    /**
     * 初始化
     * @returns {XHRIntercept}
     */
    constructor() {
        if (XHRIntercept._self) return XHRIntercept._self
        XHRIntercept._self = this

        // 修改EventListener方法
        let rawXhrAddEventListener = XMLHttpRequest.prototype.addEventListener
        XMLHttpRequest.prototype.addEventListener = function (key, func) {
            if (key === "progress") {
                this.onprogress = func
            } else {
                rawXhrAddEventListener.apply(this, arguments)
            }
        }
        let rawXhrRemoveEventListener = XMLHttpRequest.prototype.removeEventListener
        XMLHttpRequest.prototype.removeEventListener = function (key, func) {
            if (key === "progress") {
                this.onprogress = undefined
            } else {
                rawXhrRemoveEventListener.apply(this, arguments)
            }
        }

        // 修改send方法
        /** @type {function[]} */
        this.sendIntercepts = []
        this.rawXhrSend = XMLHttpRequest.prototype.send
        XMLHttpRequest.prototype.send = function () { XHRIntercept._self._xhrSend(this, arguments) }
    }

    /**
     * 添加Send拦截器
     * @param {function} func 
     */
    onXhrSend(func) {
        if (this.sendIntercepts.indexOf(func) >= 0) return
        this.sendIntercepts.push(func)
    }

    /**
     * 删除Send拦截器
     * @param {function | undefined} func 
     */
    offXhrSend(func) {
        if (typeof func === "function") {
            let index = this.sendIntercepts.indexOf(func)
            if (index < 0) return
            this.sendIntercepts.splice(index, 1)
        } else {
            this.sendIntercepts = []
        }
    }


    /**
     * 发送拦截器
     * @param {XMLHttpRequest} self 
     * @param {IArguments} args
     */
    _xhrSend(self, args) {
        let complete = () => { this.rawXhrSend.apply(self, args) }
        for (let i = 0; i < this.sendIntercepts.length; i++) {
            let flag = this.sendIntercepts[i](self, args, complete)
            if (flag) return
        }
        complete()
    }
}

// ================================================================================ 方法 ================================================================================

// 是否通过BeatSaver搜索
let searchFromBeatSaver = false

let songInfoMap = {}

/**
 * 初始化
 */
async function initScript() {
    const sandBox = Utils.getSandbox()

    await Utils.dynamicLoadJs("https://cmoyuer.gitee.io/my-resources/js/jszip.min.js")
    JSZip = sandBox.contentWindow.JSZip

    bindXHRIntercept()

    let lastPageType = "other"
    // 定时任务
    setInterval(() => {
        let url = window.location.href
        let pageType = url.indexOf("/edit/") >= 0 ? "edit" : "other"
        if (pageType === "edit") {
            if (pageType != lastPageType) {
                // 更新歌曲信息
                updateDatabase().then((hasChanged) => {
                    if (hasChanged) setTimeout(() => { window.location.reload() }, 1000)
                }).catch(err => {
                    console.log("更新数据失败：", err)
                    alert("更新歌曲信息失败，请刷新再试！")
                })
            }
            applyConvertCiphermapButton()
        } else {
            applySearchButton()
        }
        lastPageType = pageType
    }, 1000)
}

// 绑定XHR拦截器
function bindXHRIntercept() {
    let xhrIntercept = new XHRIntercept()
    /**
     * @param {XMLHttpRequest} self
     * @param {IArguments} args
     * @param {function} complete
     * @returns {boolean} 是否匹配
     */
    let onSend = function (self, args, complete) {
        let url = self._url
        if (!url || !searchFromBeatSaver) return

        if (url.startsWith("/song/staticList")) {
            // 获取歌曲列表
            let result = decodeURI(url).match(/songName=(\S*)&/)
            let key = ""
            if (result) key = result[1].replace("+", " ")
            BeatSaverUtils.searchSongList(key, 2).then(res => {
                self.extraSongList = res.songList
                songInfoMap = res.songInfoMap
                complete()
            }).catch(err => {
                alert("搜索歌曲失败！")
                console.error(err)
                self.extraSongList = []
                complete()
            })

            self.addEventListener("readystatechange", function () {
                if (this.readyState !== this.DONE) return
                const res = JSON.parse(this.responseText)
                if (this.extraSongList) {
                    res.data.data = this.extraSongList
                    res.data.total = res.data.data.length
                    this.extraSongList = []
                }
                Object.defineProperty(this, 'responseText', {
                    writable: true
                });
                this.responseText = JSON.stringify(res)
                setTimeout(() => {
                    fixSongListStyle()
                    addPreviewFunc()
                }, 200)
            });
            return true
        } else if (url.startsWith("/beatsaver/")) {
            let _onprogress = self.onprogress
            self.onprogress = undefined

            // 从BeatSaver下载歌曲
            let result = decodeURI(url).match(/\d{1,}/)
            let id = parseInt(result[0])
            BeatSaverUtils.downloadSongFile(songInfoMap[id].downloadURL, _onprogress).then(oggBlob => {
                songInfoMap[id].ogg = oggBlob
                complete()
            }).catch(err => {
                console.error(err)
                self.onerror(err)
            })

            self.addEventListener("readystatechange", function () {
                if (this.readyState !== this.DONE) return
                let result = decodeURI(url).match(/\d{1,}/)
                let id = parseInt(result[0])
                Object.defineProperty(this, 'response', {
                    writable: true
                });
                this.response = songInfoMap[id].ogg
            });
            return true
        } else if (url.startsWith("/song/ogg")) {
            // 获取ogg文件下载链接
            let result = decodeURI(url).match(/id=(\d*)/)
            let id = parseInt(result[1])
            if (id < 80000000000) return
            self.addEventListener("readystatechange", function () {
                if (this.readyState !== this.DONE) return
                const res = JSON.parse(this.responseText)
                res.code = 0
                res.data = { link: "/beatsaver/" + id }
                res.msg = "success"
                Object.defineProperty(this, 'responseText', {
                    writable: true
                });
                this.responseText = JSON.stringify(res)
            });
            complete()
            return true
        }
    }
    xhrIntercept.onXhrSend(onSend)
}

/**
 * 更新数据库
 * @param {Boolean} isForce 强制转换
 * @returns 
 */
async function updateDatabase(isForce) {
    let BLITZ_RHYTHM = await new WebDB().open("BLITZ_RHYTHM")
    let BLITZ_RHYTHM_files = await new WebDB().open("BLITZ_RHYTHM-files")
    let BLITZ_RHYTHM_official = await new WebDB().open("BLITZ_RHYTHM-official")
    // 获取用户名称
    let userName
    {
        let rawUser = await BLITZ_RHYTHM.get("keyvaluepairs", "persist:user")
        userName = JSON.parse(JSON.parse(rawUser).userInfo).name
    }
    let songInfos = []
    let hasChanged = false
    let songsInfo
    // 更新歌曲信息
    {
        let rawSongs = await BLITZ_RHYTHM.get("keyvaluepairs", "persist:songs")
        songsInfo = JSON.parse(rawSongs)
        let songsById = JSON.parse(songsInfo.byId)
        for (let key in songsById) {
            let officialId = songsById[key].officialId
            if (typeof officialId != "number" || (!isForce && officialId < 80000000000)) continue
            let songInfo = songsById[key]
            songInfos.push(JSON.parse(JSON.stringify(songInfo)))
            songInfo.coverArtFilename = songInfo.coverArtFilename.replace("" + songInfo.officialId, songInfo.id)
            songInfo.songFilename = songInfo.songFilename.replace("" + songInfo.officialId, songInfo.id)
            songInfo.officialId = ""
            songInfo.mapAuthorName = userName
            songsById[key] = songInfo
            hasChanged = true
        }
        songsInfo.byId = JSON.stringify(songsById)
    }
    // 处理文件
    for (let index in songInfos) {
        let songInfo = songInfos[index]
        // 复制封面和音乐文件
        let cover = await BLITZ_RHYTHM_official.get("keyvaluepairs", songInfo.coverArtFilename)
        let song = await BLITZ_RHYTHM_official.get("keyvaluepairs", songInfo.songFilename)
        await BLITZ_RHYTHM_files.put("keyvaluepairs", songInfo.coverArtFilename.replace("" + songInfo.officialId, songInfo.id), cover)
        await BLITZ_RHYTHM_files.put("keyvaluepairs", songInfo.songFilename.replace("" + songInfo.officialId, songInfo.id), song)
        // 添加info记录
        await BLITZ_RHYTHM_files.put("keyvaluepairs", songInfo.id + "_Info.dat", JSON.stringify({ _songFilename: "song.ogg" }))
    }
    // 保存数据
    if (hasChanged) await BLITZ_RHYTHM.put("keyvaluepairs", "persist:songs", JSON.stringify(songsInfo))
    BLITZ_RHYTHM.close()
    BLITZ_RHYTHM_files.close()
    BLITZ_RHYTHM_official.close()
    return hasChanged
}


/**
 * 修复歌单布局
 */
function fixSongListStyle() {
    let songListBox = $(".css-10szcx0")[0]
    songListBox.style["grid-template-columns"] = "repeat(3, minmax(0px, 1fr))"
    let songBox = songListBox.parentNode
    if ($(".css-1wfsuwr").length > 0) {
        songBox.style["overflow-y"] = "hidden"
        songBox.parentNode.style["margin-bottom"] = ""
    } else {
        songBox.style["overflow-y"] = "auto"
        songBox.parentNode.style["margin-bottom"] = "44px"
    }
    let itemBox = $(".css-bil4eh")
    for (let index = 0; index < itemBox.length; index++)
        itemBox[index].style.width = "230px"
}

/**
 * 在歌曲Card中添加双击预览功能
 */
function addPreviewFunc() {
    let searchBox = $(".css-1d92frk")
    $("#preview_tip").remove()
    searchBox.after("<div style='text-align: center;color:gray;padding-bottom:10px;' id='preview_tip'>双击歌曲可预览曲谱</div>")
    let infoViewList = $(".css-bil4eh")
    for (let index in infoViewList) {
        infoViewList[index].ondblclick = () => {
            let name = $(infoViewList[index]).find(".css-1y1rcqj")[0].innerHTML
            let result = name.match(/^\[(\w*)\]/)
            if (!result) return
            let previewUrl = "https://skystudioapps.com/bs-viewer/?id=" + result[1]
            window.open(previewUrl)
        }
    }
}

/**
 * 添加通过BeatSaver搜索歌曲的按钮
 */
function applySearchButton() {
    let boxList = $(".css-1u8wof2") // 弹窗
    if (boxList.length == 0) return
    let searchBoxList = boxList.find(".css-70qvj9")
    if (searchBoxList.length == 0 || searchBoxList[0].childNodes.length >= 3) return // 搜索栏元素数量

    let rawSearchBtn = $(boxList[0]).find("button")[0] // 搜索按钮

    // 添加一个按钮
    let searchBtn = document.createElement("button")
    searchBtn.className = rawSearchBtn.className
    searchBtn.innerHTML = "BeatSaver"
    $(rawSearchBtn.parentNode).append(searchBtn);

    // 绑定事件
    rawSearchBtn.onmousedown = () => {
        searchFromBeatSaver = false
        $("#preview_tip").remove()
    }
    searchBtn.onmousedown = () => {
        searchFromBeatSaver = true
        $(rawSearchBtn).click()
    }
}

/**
 * 添加转换官方谱面的按钮
 * @returns 
 */
async function applyConvertCiphermapButton() {
    let BLITZ_RHYTHM = await new WebDB().open("BLITZ_RHYTHM")
    try {
        let rawSongs = await BLITZ_RHYTHM.get("keyvaluepairs", "persist:songs")
        let songsInfo = JSON.parse(rawSongs)
        let songsById = JSON.parse(songsInfo.byId)
        let songId = CipherUtils.getNowBeatmapInfo().id
        let officialId = songsById[songId].officialId
        if (!officialId) return
    } catch (error) {
        console.error(error)
        return
    } finally {
        BLITZ_RHYTHM.close()
    }

    let divList = $(".css-1tiz3p0")
    if (divList.length > 0) {
        if ($("#div-sync").length > 0) return
        let divBox = $(divList[0]).clone()
        divBox[0].id = "div-sync"
        divBox.find(".css-ujbghi")[0].innerHTML = "转换为自定义谱面"
        divBox.find(".css-1exyu3y")[0].innerHTML = "将官方谱面转换为自定义谱面, 以导出带有音乐文件的完整谱面压缩包。"
        divBox.find(".css-1y7rp4x")[0].innerText = "开始转换谱面"
        divBox[0].onclick = e => {
            // 更新歌曲信息
            updateDatabase(true).then((hasChanged) => {
                if (hasChanged) setTimeout(() => { window.location.reload() }, 1000)
            }).catch(err => {
                console.log("转换谱面失败：", err)
                alert("转换谱面失败，请刷新再试！")
            })
        }
        $(divList[0].parentNode).append(divBox)
    }
}

// ================================================================================ 入口 ================================================================================

// 主入口
(function () {
    'use strict';

    initScript()
})()

