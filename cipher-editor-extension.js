// ==UserScript==
// @name         《闪韵灵镜谱面编辑器》功能扩展
// @namespace    cipher-editor-extension
// @version      1.0
// @description  为《闪韵灵镜谱面编辑器》扩展各种实用的功能
// @author       如梦Nya
// @license      MIT
// @run-at       document-body
// @grant        unsafeWindow
// @match        https://cipher-editor-cn.picovr.com/*
// @icon         https://cipher-editor-cn.picovr.com/assets/logo-eabc5412.png
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

const $ = window.jQuery
let JSZip = undefined

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

    /**
     * 关闭编辑器顶部菜单
     */
    static closeEditorTopMenu() {
        $(".css-1k12r02").click()
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
 * 沙盒工具类
 */
class SandBox {
    /** @type {HTMLIFrameElement | undefined} */
    static _sandBoxIframe = undefined

    /**
     * 创建一个Iframe沙盒
     * @returns {HTMLIFrameElement}
     */
    static getDocument() {
        if (!SandBox._sandBoxIframe) {
            let id = GM_info.script.namespace + "_iframe"

            // 找ID
            let iframes = $('#' + id)
            if (iframes.length > 0) SandBox._sandBoxIframe = iframes[0]

            // 不存在，创建一个
            if (!SandBox._sandBoxIframe) {
                let ifr = document.createElement("iframe");
                ifr.id = id
                ifr.style.display = "none"
                document.body.appendChild(ifr);
                SandBox._sandBoxIframe = ifr;
            }
        }
        return SandBox._sandBoxIframe
    }

    /**
     * 动态添加Script
     * @param {string} url 脚本链接
     * @returns {Promise<Element>}
     */
    static dynamicLoadJs(url) {
        return new Promise(function (resolve, reject) {
            let ifrdoc = SandBox.getDocument().contentDocument;
            let script = ifrdoc.createElement('script')
            script.type = 'text/javascript'
            script.src = url
            script.onload = script.onreadystatechange = function () {
                if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                    resolve(script)
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
        let zip = await JSZip.loadAsync(zipBlob)
        let eggFile = undefined
        for (let fileName in zip.files) {
            if (!fileName.endsWith(".egg")) continue
            eggFile = zip.file(fileName)
            break
        }
        let rawBuffer = await eggFile.async("arraybuffer")
        return CipherUtils.applySongFile(rawBuffer)
    }

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
        let zip = await JSZip.loadAsync(zipBlob)
        // 谱面信息
        let infoFile
        for (let fileName in zip.files) {
            if (fileName.toLowerCase() !== "info.dat") continue
            infoFile = zip.files[fileName]
            break
        }
        if (!infoFile) throw "请检查压缩包中是否包含info.dat文件"
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

/**
 * 通用工具类
 */
class Utils {
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
// ================================================================================ 拓展 ================================================================================

class SearchSongExtension {
    constructor() {
        this.searchFromBeatSaver = false
        this.songInfoMap = {}
        this.lastPageType = "other"
    }

    // 加载XHR拦截器
    initXHRIntercept() {
        let _this = this
        let xhrIntercept = new XHRIntercept()
        /**
         * @param {XMLHttpRequest} self
         * @param {IArguments} args
         * @param {function} complete
         * @returns {boolean} 是否匹配
         */
        let onSend = function (self, args, complete) {
            let url = self._url
            if (!url || !_this.searchFromBeatSaver) return

            if (url.startsWith("/song/staticList")) {
                // 获取歌曲列表
                let result = decodeURI(url).match(/songName=(\S*)&/)
                let key = ""
                if (result) key = result[1].replace("+", " ")
                BeatSaverUtils.searchSongList(key, 2).then(res => {
                    self.extraSongList = res.songList
                    _this.songInfoMap = res.songInfoMap
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
                        _this.fixSongListStyle()
                        _this.addPreviewFunc()
                    }, 200)
                });
                return true
            } else if (url.startsWith("/beatsaver/")) {
                let _onprogress = self.onprogress
                self.onprogress = undefined

                // 从BeatSaver下载歌曲
                let result = decodeURI(url).match(/\d{1,}/)
                let id = parseInt(result[0])
                BeatSaverUtils.downloadSongFile(_this.songInfoMap[id].downloadURL, _onprogress).then(oggBlob => {
                    _this.songInfoMap[id].ogg = oggBlob
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
                    this.response = _this.songInfoMap[id].ogg
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
    async updateDatabase(isForce) {
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
    fixSongListStyle() {
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
    addPreviewFunc() {
        let searchBox = $(".css-1d92frk")
        $("#preview_tip").remove()
        searchBox.after("<div style='text-align: center;color:gray;padding-bottom:10px;' id='preview_tip'>双击歌曲可预览曲谱</div>")
        let infoViewList = $(".css-bil4eh")
        for (let index = 0; index < infoViewList.length; index++) {
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
    applySearchButton() {
        let boxList = $(".css-1u8wof2") // 弹窗
        try {
            if (boxList.length == 0) throw "Box not found"
            let searchBoxList = boxList.find(".css-70qvj9")
            if (searchBoxList.length == 0) throw "item too few" // 搜索栏元素数量
            if (searchBoxList[0].childNodes.length >= 3) return // 搜索栏元素数量
        } catch {
            if (this.searchFromBeatSaver) this.searchFromBeatSaver = false
            return
        }

        let rawSearchBtn = $(boxList[0]).find("button")[0] // 搜索按钮

        // 添加一个按钮
        let searchBtn = document.createElement("button")
        searchBtn.className = rawSearchBtn.className
        searchBtn.innerHTML = "BeatSaver"
        $(rawSearchBtn.parentNode).append(searchBtn);

        // 绑定事件
        rawSearchBtn.onmousedown = () => {
            this.searchFromBeatSaver = false
            $("#preview_tip").remove()
        }
        searchBtn.onmousedown = () => {
            this.searchFromBeatSaver = true
            $(rawSearchBtn).click()
        }
    }
    /**
     * 添加转换官方谱面的按钮
     * @returns 
     */
    async applyConvertCiphermapButton() {
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
            if ($("#div-custom").length > 0) return
            let divBox = $(divList[0]).clone()
            divBox[0].id = "div-custom"
            divBox.find(".css-ujbghi")[0].innerHTML = "转换为自定义谱面"
            divBox.find(".css-1exyu3y")[0].innerHTML = "将官方谱面转换为自定义谱面, 以导出带有音乐文件的完整谱面压缩包。"
            divBox.find(".css-1y7rp4x")[0].innerText = "开始转换谱面"
            divBox[0].onclick = e => {
                // 更新歌曲信息
                this.updateDatabase(true).then((hasChanged) => {
                    if (hasChanged) setTimeout(() => { window.location.reload() }, 1000)
                }).catch(err => {
                    console.log("转换谱面失败：", err)
                    alert("转换谱面失败，请刷新再试！")
                })
            }
            $(divList[0].parentNode).append(divBox)
        }
    }
    /**
     * 定时任务 1s
     */
    handleTimer() {
        let url = window.location.href
        let pageType = url.indexOf("/edit/") >= 0 ? "edit" : "other"
        if (pageType === "edit") {
            if (pageType != this.lastPageType) {
                // 更新歌曲信息
                this.updateDatabase().then((hasChanged) => {
                    if (hasChanged) setTimeout(() => { window.location.reload() }, 1000)
                }).catch(err => {
                    console.log("更新数据失败：", err)
                    alert("更新歌曲信息失败，请刷新再试！")
                })
            }
            this.applyConvertCiphermapButton()
        } else {
            this.applySearchButton()
        }
        this.lastPageType = pageType
    }
    async init() {
        // 初始化XHR拦截器
        this.initXHRIntercept()

        // 启动定时任务
        setInterval(() => { this.handleTimer() }, 1000)
    }
}

class ImportBeatmapExtension {
    constructor() {

    }

    /**
     * 在顶部菜单添加导入按钮
     */
    addImportButton() {
        if ($("#importBeatmap").length > 0) return
        let btnsBoxList = $(".css-4e93fo")
        if (btnsBoxList.length == 0) return
        // 按键组
        let div = document.createElement("div")
        div.style["display"] = "flex"
        // 按钮模板
        let btnTemp = $(btnsBoxList[0].childNodes[0])
        // 按钮1
        let btnImportBs = btnTemp.clone()[0]
        btnImportBs.id = "importBeatmap"
        btnImportBs.innerHTML = "导入谱面 BeatSaver链接"
        btnImportBs.onclick = () => { this.importFromBeatSaver() }
        btnImportBs.style["font-size"] = "13px"
        div.append(btnImportBs)
        // 按钮2
        let btnImportZip = btnTemp.clone()[0]
        btnImportZip.id = "importBeatmap"
        btnImportZip.innerHTML = "导入谱面 BeatSaber压缩包"
        btnImportZip.onclick = () => { this.importFromBeatmap() }
        btnImportZip.style["margin-left"] = "5px"
        btnImportZip.style["font-size"] = "13px"
        div.append(btnImportZip)
        // 添加
        btnsBoxList[0].prepend(div)
    }

    async importFromBeatSaver() {
        try {
            // 获取当前谱面信息
            let nowBeatmapInfo = CipherUtils.getNowBeatmapInfo()

            // 获取谱面信息
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
            await this.importBeatmap(zipBlob, nowBeatmapInfo)
        } catch (err) {
            console.error(err)
            alert("出错啦：" + err)
            CipherUtils.hideLoading()
        }
    }

    /**
     * 通过压缩文件导入
     */
    importFromBeatmap() {
        try {
            // 创建上传按钮
            let fileSelect = document.createElement('input')
            fileSelect.type = 'file'
            fileSelect.style.display = "none"

            fileSelect.accept = ".zip,.rar"
            fileSelect.addEventListener("change", (e) => {
                let files = e.target.files
                if (files == 0) return
                CipherUtils.showLoading()
                let file = files[0]
                // 获取当前谱面信息
                let nowBeatmapInfo = CipherUtils.getNowBeatmapInfo()
                this.importBeatmap(new Blob([file]), nowBeatmapInfo).catch(err => {
                    CipherUtils.hideLoading()
                    console.error(err)
                    alert("出错啦：" + err)
                })
            })
            // 点击按钮
            document.body.append(fileSelect)
            fileSelect.click()
            fileSelect.remove()
        } catch (err) {
            alert("出错啦：" + err)
        }
    }

    /**
     * 从BeatSaber谱面压缩包导入信息
     * @param {Blob} zipBlob
     * @param {{id:string, difficulty:string, beatsaverId:string}} nowBeatmapInfo
     */
    async importBeatmap(zipBlob, nowBeatmapInfo) {
        let BLITZ_RHYTHM_files = await new WebDB().open("BLITZ_RHYTHM-files")
        try {
            // 获取当前谱面信息
            let datKey = nowBeatmapInfo.id + "_" + nowBeatmapInfo.difficulty + "_Ring.dat"
            let datStr = await BLITZ_RHYTHM_files.get("keyvaluepairs", datKey)
            let datInfo = JSON.parse(datStr)
            if (datInfo._version !== "2.3.0")
                throw "插件不支持该谱面版本！可尝试重新创建谱面"
            let beatmapInfo = await BeatSaverUtils.getBeatmapInfo(zipBlob)
            if (beatmapInfo.difficulties.length == 0)
                throw "该谱面找不到可用的难度"
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
                    if (!difficulty) {
                        // Cancel
                        CipherUtils.hideLoading()
                        return
                    }
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
            let beatmapInfoStr = await beatmapInfo.files[beatmapInfo.difficulties[tarDifficulty - 1]].async("string")
            let changeInfo = this.convertBeatMapInfo(beatmapInfo.version, JSON.parse(beatmapInfoStr))
            datInfo._notes = changeInfo._notes
            datInfo._obstacles = changeInfo._obstacles
            await BLITZ_RHYTHM_files.put("keyvaluepairs", datKey, JSON.stringify(datInfo))
            // 导入完成
            setTimeout(() => {
                CipherUtils.closeEditorTopMenu()
                window.location.reload()
            }, 1000)
        } catch (error) {
            throw error
        } finally {
            BLITZ_RHYTHM_files.close()
        }
    }

    /**
     * 转换BeatSaber谱面信息
     * @param {string} version
     * @param {JSON} info 
     */
    convertBeatMapInfo(version, rawInfo) {
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

    /**
     * 初始化
     */
    async init() {
        setInterval(() => {
            this.addImportButton()
        }, 1000)
    }
}

// ================================================================================ 入口 ================================================================================

(async function () {
    'use strict';

    // 依赖库
    const sandBox = SandBox.getDocument()
    await SandBox.dynamicLoadJs("https://cmoyuer.gitee.io/my-resources/js/jszip.min.js")
    JSZip = sandBox.contentWindow.JSZip

    // 加载拓展
    new SearchSongExtension().init()
    new ImportBeatmapExtension().init()
})()

