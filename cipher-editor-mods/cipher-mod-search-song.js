// ==UserScript==
// @name        Cipher Extra Song Search
// @name:cn     闪韵灵境歌曲搜索扩展
// @namespace   cipher-editor-mod-extra-song-search
// @version     1.0
// @description 通过BeatSaver方便添加歌曲
// @description:cn 通过BeatSaver方便添加歌曲
// @author      如梦Nya
// @license     MIT
// @run-at      document-body
// @grant       unsafeWindow
// @match       https://cipher-editor-cn.picovr.com/*
// @match       https://cipher-editor-va.picovr.com/*
// @icon        https://cipher-editor-va.picovr.com/favicon.ico
// @require     https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

const I18N = {
    en: {
        config: {
            search_page_sum: {
                name: "Search Page Count",
                description: "Number of pages searched from BeatSaver at one time",
            }
        }
    },
    cn: {
        config: {
            search_page_sum: {
                name: "搜索页面数量",
                description: "每次从BeatSaver搜索歌曲的页数，页数越多速度越慢",
            }
        }
    }
}

const CONFIG = {
    search_page_sum: {
        name: $t("config.search_page_sum.name"),
        description: $t("config.search_page_sum.description"),
        default: 1
    }
}

const METHODS = [
    {
        name: "Test",
        name_cn: "测试",
        func: () => {
            console.log("Test")
        }
    }
]

function onEnabled() {
    log("onEnabled")
}

function onDisabled() {
    log("onDisabled")
}

(function () {
    'use strict'

})()
