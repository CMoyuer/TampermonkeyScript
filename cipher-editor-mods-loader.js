// ==UserScript==
// @name        《闪韵灵境谱面编辑器》模组加载器
// @namespace   cipher-editor-mods-loader
// @version     1.0.0
// @description 为《闪韵灵境谱面编辑器》扩展各种实用的功能
// @author      如梦Nya
// @license     MIT
// @run-at      document-start
// @grant       unsafeWindow
// @grant       GM_xmlhttpRequest
// @match       https://cipher-editor-cn.picovr.com/*
// @match       https://cipher-editor-va.picovr.com/*
// @icon        https://cipher-editor-va.picovr.com/favicon.ico
// @require     https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

const modLoader = {
    window,
};

(function () {
    'use strict'

    setTimeout(() => {
        let iframe = document.createElement("iframe")
        iframe.style = "width:400px;height:800px;"
        GM_xmlhttpRequest({
            url: "http://127.0.0.1",
            method: "GET",
            onload: res => {
                console.log(res.response)
                iframe.srcdoc = res.response
            },
            onerror: res => {
                console.error(res)
            }
        })
        $("#root").append(iframe)
    }, 2000)
})();