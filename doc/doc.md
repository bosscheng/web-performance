# 讨论

```
// 重定向耗时
redirect: timing.redirectEnd - timing.redirectStart,
// DOM 渲染耗时
dom: timing.domComplete - timing.domLoading,
// 页面加载耗时
load: timing.loadEventEnd - timing.navigationStart,
// 页面卸载耗时
unload: timing.unloadEventEnd - timing.unloadEventStart,
// 请求耗时
request: timing.responseEnd - timing.requestStart,
```

# 白屏时间

放在head 头部。

```
<script>
    whiteScreen = new Date() - performance.timing.navigationStart
    // 通过 domLoading 和 navigationStart 也可以
    whiteScreen = performance.timing.domLoading - performance.timing.navigationStart
</script>

```


# 错误捕获

1. 资源加载错误，通过 addEventListener('error', callback, true) 在捕获阶段捕捉资源加载失败错误。
2. js 执行错误，通过 window.onerror 捕捉 js 错误。
3. promise 错误，通过 addEventListener('unhandledrejection', callback)捕捉 promise 错误，但是没有发生错误的行数，列数等信息，只能手动抛出相关错误信息。

# 数据上报

https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback

```js

if (window.requestIdleCallback) {
    window.requestIdleCallback(() => {
        monitor.performance = getPerformance()
        monitor.resources = getResources()
    })
}
```


# SPA 
window.performance API 是有缺点的，在 SPA 切换路由时，window.performance.timing 的数据不会更新。
所以我们需要另想办法来统计切换路由到加载完成的时间。
拿 Vue 举例，一个可行的办法就是切换路由时，在路由的全局前置守卫 beforeEach 里获取开始时间，在组件的 mounted 钩子里执行 vm.$nextTick  函数来获取组件的渲染完毕时间。


# 用户信息收集
使用 window.navigator 可以收集到用户的设备信息，操作系统，浏览器信息...



## navigator

## UA(unique visitor)
是指通过互联网浏览这个网页的访客，00:00-24:00 内相同的设备访问只被计算一次。一天内同个访客多次访问仅计算一个 UV。

在用户访问网站时，可以生成一个随机字符串+时间日期，保存在本地。在网页发生请求时（如果超过当天24小时，则重新生成），把这些参数传到后端，后端利用这些信息生成 UV 统计报告。

## PV(page View)

即页面浏览量或点击量，用户每 1 次对网站中的每个网页访问均被记录 1 个PV。用户对同一页面的多次访问，访问量累计，用以衡量网站用户访问的网页数量。

# 页面停留时间

## 传统网站

用户在进入 A 页面时，通过后台请求把用户进入页面的时间捎上。过了 10 分钟，用户进入 B 页面，这时后台可以通过接口捎带的参数可以判断出用户在 A 页面停留了 10 分钟。

## SPA

可以利用 router 来获取用户停留时间，拿 Vue 举例，通过 router.beforeEach、destroyed 这两个钩子函数来获取用户停留该路由组件的时间。

## 浏览深度

通过 document.documentElement.scrollTop 属性以及屏幕高度，可以判断用户是否浏览完网站内容。


## 页面跳转来源

通过 document.referrer 属性，可以知道用户是从哪个网站跳转而来。

