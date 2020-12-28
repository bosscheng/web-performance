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
