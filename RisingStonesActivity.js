// ==UserScript==
// @name               FF14石之家活动助手
// @namespace          https://github.com/cmoyuer
// @version            1.2.0
// @author             lisonge
// @description        自动完成FF14石之家活动
// @icon               https://ff14risingstones.web.sdo.com/favicon.ico
// @match              *://*/*
// @connect            apiff14risingstones.web.sdo.com
// @grant              GM_registerMenuCommand
// @grant              GM_unregisterMenuCommand
// @grant              GM_xmlhttpRequest
// @grant              GM_openInTab
// @grant              unsafeWindow
// @require            https://code.jquery.com/jquery-3.6.0.min.js
// @noframes
// ==/UserScript==

const $ = window.jQuery;
const apiUrl = "https://apiff14risingstones.web.sdo.com/api";

(function () {
    'use strict';
    let btnList = []

    btnList.push({
        name: "迎新活动",
        url: "https://ff14risingstones.web.sdo.com/project/ffstoneonline/pc/index.html#/index",
        func: async () => {
            // 活动信息
            let likeNum = 5
            let activeId = "online2312"
            // 判断是否已登录
            await isLogin()
            // 获取任务完成情况
            let taskInfo = await getTaskInfo(activeId)
            let dayTask = taskInfo.dayTask
            // 签到
            if (dayTask.sign_status == 0) await loginIn()
            // 签到盖章
            if (dayTask.sign_seal == 0) await doSeal(activeId, 1)
            // 点赞
            if (dayTask.like_num < likeNum) {
                likeNum -= dayTask.like_num
                let posts_id = ""
                while (!posts_id) {
                    let postList = await getPostList()
                    for (let i = 0; i < postList.length; i++) {
                        let info = postList[i]
                        if (info.is_top || info.is_like) continue
                        await likePost(info.posts_id)
                        posts_id = info.posts_id
                        if (--likeNum <= 0) break
                    }
                }
            }
            // 点赞盖章
            if (dayTask.like_seal == 0) await doSeal(activeId, 2)
            // 评论
            if (dayTask.comment_status == 0) {
                let posts_id = ""
                console.log(posts_id,!posts_id)
                while (!posts_id) {
                    let postList = await getPostList()
                    for (let i = 0; i < postList.length; i++) {
                        let info = postList[i]
                        if (info.is_top || info.is_refine) continue
                        await commentPost(info.posts_id, "<p><span class=\"at-emo\">[emo1]</span></p>")
                        posts_id = info.posts_id
                        break
                    }
                }
                // 删除刚刚的评论
                let postList = await getMyCommentList()
                for (let i = 0; i < postList.length; i++) {
                    let postInfo = postList[i]
                    if (postInfo.posts_id != posts_id) continue
                    await deleteComment(postInfo.posts_comment_id)
                    break
                }
            }
            // 评论盖章
            if (dayTask.comment_seal == 0) await doSeal(activeId, 3)
        }
    })

    btnList.forEach((item, index, arr) => {
        GM_registerMenuCommand(item.name, async () => {
            try {
                await item.func()
                if (item.url) {
                    if (confirm("【石之家活动助手】打卡已完成，打开活动页看看吧？"))
                        GM_openInTab(item.url, false)
                } else {
                    alert("【石之家活动助手】打卡已完成")
                }
            } catch (error) {
                if (error) alert("【石之家活动助手】打卡失败：" + error)
            }
        });
    })
})();

// =================================== func ===================================

/**
 * 获取指定活动信息
 * @param {string} activeId 
 * @returns 
 */
async function getTaskInfo(activeId) {
    let res = await ajax({
        url: "/home/active/" + activeId + "/myTaskInfo",
        method: "GET",
        responseType: "json"
    })
    if (res.code != 10000) {
        if (confirm("【石之家活动助手】获取活动信息失败（" + res.msg + "），要不要去石之家看看呢？"))
            GM_openInTab("https://ff14risingstones.web.sdo.com/pc/index.html#/me/info", false)
        throw false
    }
    return res.data
}

// =================================== Apis ===================================

/**
 * 判断是否已登录
 */
async function isLogin() {
    let res = await ajax({
        url: "/home/GHome/isLogin",
        method: "GET",
        responseType: "json"
    })
    if (res.code != 10000) {
        if (confirm("【石之家活动助手】您还没有登录石之家，是否现在去登录呢"))
            GM_openInTab("https://ff14risingstones.web.sdo.com/pc/index.html#/me/info", false)
        throw false
    }
}

/**
 * 签到
 */
async function loginIn() {
    let res = await ajax({
        url: "/home/sign/signIn",
        method: "POST",
        responseType: "json"
    })
    if (res.code != 10000 && res.code != 10001) {
        console.error("签到失败", res)
        throw res.msg
    }
}

/**
 * 获取文章列表
 */
async function getPostList(option) {
    if (typeof option != "object") option = {}
    if (typeof option.type == "undefined") option.type = 1
    if (typeof option.is_top == "undefined") option.is_top = 0
    if (typeof option.is_refine == "undefined") option.is_refine = 0
    if (typeof option.part_id == "undefined") option.part_id = ""
    if (typeof option.hotType == "undefined") option.hotType = "postsHotNow"
    if (typeof option.order == "undefined") option.order = ""
    if (typeof option.page == "undefined") option.page = 1
    if (typeof option.limit == "undefined") option.limit = 15
    let dataStr = ""
    for (let key in option) {
        if (!option.hasOwnProperty(key)) continue
        if (dataStr.length > 0) dataStr += "&"
        dataStr += key + "=" + option[key]
    }
    let res = await ajax({
        url: "/home/posts/postsList?" + dataStr,
        method: "GET",
        responseType: "json"
    })
    if (res.code != 10000) throw res.msg
    return res.data.rows
}

/**
 * 点赞文章
 */
async function likePost(id) {
    let formData = new FormData()
    formData.append("type", 1)
    formData.append("id", id)

    let res = await ajax({
        url: "/home/posts/like",
        method: "POST",
        data: formData,
        responseType: "json",
        contentType: false,
        processData: false,
    })
    if (res.code != 10000) {
        console.error("点赞失败", res)
        throw res.msg
    }
}

/**
 * 评论文章
 */
async function commentPost(posts_id, content) {
    let formData = new FormData()
    formData.append("content", content)
    formData.append("posts_id", posts_id)
    formData.append("parent_id", 0)
    formData.append("root_parent", 0)
    formData.append("comment_pic", "")

    let res = await ajax({
        url: "/home/posts/comment",
        method: "POST",
        data: formData,
        responseType: "json",
        contentType: false,
        processData: false,
    })
    if (res.code != 10000) {
        console.error("评论失败", res)
        throw res.msg
    }
}

/**
 * 获取我的评论列表
 * @param {string | number | undefined} page 
 * @returns 
 */
async function getMyCommentList(page = 1) {
    let res = await ajax({
        url: "/home/sysMsg/commentMsg?channel=2&page=" + page,
        method: "GET",
        responseType: "json"
    })
    if (res.code != 10000) {
        console.error("获取评论列表失败", res)
        throw res.msg
    }
    return res.data
}

/**
 * 删除评论
 * @param {string | number} commentId 
 */
async function deleteComment(commentId) {
    console.log(JSON.stringify({ "comment_id": commentId }))
    let res = await ajax({
        url: "/home/posts/deleteComment",
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ "comment_id": commentId }),
        responseType: "json",
        // contentType: "application/json",
        processData: false,
    })
    if (res.code != 10000) {
        console.error("删除评论失败", res)
        throw res.msg
    }
}

/**
 * 活动每日盖章
 * @param {string} activeId 
 * @param {number} type 
 */
async function doSeal(activeId, type) {
    let formData = new FormData()
    formData.append("type", type)
    let res = await ajax({
        url: "/home/active/" + activeId + "/doSeal",
        method: "POST",
        data: formData,
        responseType: "json",
        contentType: false,
        processData: false,
    })
    if (res.code != 10000) {
        console.error("盖章失败", res)
        throw res.msg
    }
}

// =================================== Utils ===================================

function ajax(config) {
    if (config && config.url && config.url.startsWith("/"))
        config.url = apiUrl + config.url
    return new Promise((resolve, reject) => {
        config.onload = res => {
            if (res.status >= 200 && res.status < 300) {
                try {
                    resolve(JSON.parse(res.response))
                } catch {
                    resolve(res.response)
                }
            }
            else {
                reject("HTTP Code: " + res.status)
            }
        }
        config.onerror = err => {
            reject(err)
        }
        GM_xmlhttpRequest(config)
    })
}
