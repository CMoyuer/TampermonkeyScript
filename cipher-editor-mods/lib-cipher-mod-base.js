// ==UserScript==
// @name        闪韵灵境谱面导入扩展
// @namespace   lib-cipher-mod-base
// @version     1.0.0
// @description 兼容其他格式的谱面数据导入
// @author      如梦Nya
// @license     MIT
// @match       *://*/*
// ==/UserScript==
const scriptInfo = window.GM_info.script
// const icon = window.GM_info.script.icon
// const scriptName = window.GM_info.script.name
const scriptNamespace = scriptInfo.namespace

function log(...data) {
    console.log("[" + scriptNamespace + "]", ...data)
}

function $t(key) {

}

(function () {
    'use strict'

    let _methods = {
        enabled: () => {
            if (typeof (onEnabled) === "function")
                onEnabled()
        },
        disabled: () => {
            if (typeof (onDisabled) === "function")
                onDisabled()
        }
    }

    let handle = setInterval(() => {
        if (!unsafeWindow.modloader) return
        unsafeWindow.modloader.addMod({
            id: scriptNamespace,
            info: scriptInfo,
            config: CONFIG,
            methods: METHODS,
            _methods,
            window,
        })
        clearInterval(handle)
    }, 100)
})()