[toc]

# 背景
之前有做过前端的浏览器性能监测的前端，这里拿出来分享下。

## 目标
对于基本的浏览器性能监测所要收集的数据。
1. 页面分析（用户信息）
2. ajax请求
3. JS错误
4. 浏览器监测
5. 慢页面追踪
6. 区域分析
7. 运营商分析
8. 接入方式
9. 搜索引擎分析
10. 数据上报的时机

## 常见指标

- 页面加载时长（page load time）
- 首屏加载时长（above-the-fold time）
- DOM Ready 时长
- DOM Complete 时长
- DOM Interactive 时长
- 首字节等待时长（Time to Frist Byte）
- 首次渲染时长（first paint）
- 首次内容渲染时长（first contentful paint）
- 首次有效渲染时长（first meaningful paint）
- 首次可交互时长（first interactive）
- 首次CPU 空闲时长（first cpu idle）
- speed index
- perceptual speed index
- last painted heros
- paint phase timing
- 开始渲染（start render）
- 视觉完整时间

### 首次渲染（first paint）
首次渲染是指第⼀个非网页背景像素渲染，

First Paint 还是通过浏览器的渲染引擎来计算出来的时间

### 首次内容渲染（first contentful paint）
⾸次内容渲染是指第一个⽂本、图像、背景图片或非白色 canvas/SVG 渲染。

### 首次有效渲染时长（first meaningful paint）
这个指标最早是由 Google 提出的，它的一个核心的想法是渲染并不一定代表着用户看到了主要内容，Load 也不一定代表用户看到主要内容，那用户什么时候能够看到主要内容呢？我们假设当一个网页的 DOM 结构发生剧烈的变化的时候，就是这个网页主要内容出现的时候，那么在这样的一个时间点上，就是用户看到主要内容的一个时间点。

它的优点是相对校准的估算出内容渲染时间，贴近用户感知。但缺点是无原生 API 支持，算法推导时 DOM 节点不含权重。

### 开始渲染时间（start render time）
这个指标时间是没有办法或者很难通过 JS 在用户环境执行来获取的。

Start Render Time 就是客观观察到页面的一个加载变化的时间，

### 结论（最优解决方案）

上报页⾯加载开始时间，以及后续各时间点相对增量，在数据端进行阶段清洗和异常处理。

分析性能指标时建议关注百分位数 (percentile)，对性能的要求越高，使用越大的百分位数。

## 页面分析
页面分析，主要是收集用户是否第一次访问这个页面，以及是否是今天第一次访问这个页面，用于记录PV数据的。记录下从哪个页面来的。

收集 userAgent 可以统计统计不同版本浏览器和设备类型的平均页面加载时间和吞吐率。

主要记录的数据有
- 第一次访问的日期
- 是否第一天访问
- 是否第一次访问
- 页面来源（上一个页面）
- 浏览器语言
- 屏幕的宽度
- 屏幕的高度
- 浏览器的userAgent

为了记住这个用户是谁需要存储一个永久的id，存储在localstorage 里面。
为了记住用户这一次的访问，需要在cookie 里存储一个会话表示的信息。

### 具体实现


```javascript

var pageRef = document.referrer || ''; 
var browserLanguage = navigator.language || navigator.browserLanguage; 
var screenHeight = window.screen && window.screen.height;
var screenWidth =  window.screen && window.screen.width;
var userAgent = navigator.userAgent;
```


## ajax请求

主要收集的ajax 信息
- 方法 method
- 请求的 url
- 请求时间
- 响应时间
- ajax 状态
- 上传数据量
- 下载数据量
- 如果ajax发生错误(error,timeout,abort)。
- 回调时间

需要通过 AOP XMLHttpRequest 来实现。

AOP 的核心代码
```javascript
function aop(target, key, callback, options){
    if(!target){
        return false;
    }
    
    var _func = null;
    try{
        _func = target[key];
    }
    catch(e){
        return false;
    }
    
    if(!_func){
        return false;
    }
    
    if(_func && _func._aop){
        return false;
    }
    
    try {
        target[key] = callback(_func, options);
    } catch (e) {
        return false;
    }
    
    target[key]._aop = [_func];
    return true;
}
```

然后aop XMLHttpRequest 的 open 方法和 send 方法。

```javascript

 var XHR = window.XMLHttpRequest;
 aop(XHR.prototype,'open',function(evnet){
    return function(){
        if (!this._aop) {
            var args = getArgumentsArray.apply(this, arguments);
            // 
            this._aopData = {
                //
                method: args[0],
                url: args[1],
                start: now(),
            };
        }

        try {
            return event.apply(this, arguments);
        } catch (e) {
            return Function.prototype.apply.call(event, this, arguments);
        } 
    } 
     
 });


```

在send 方法里面，继续 aop onreadystatechange 方法。

aop loadstart 方法来记录 开始时间。

同时也aop了 error，abort，timeout  来监听错误。



```javascript
aop(XHR.prototype,'send',function(event){
     return function(){
        var _this = this;
        var tempCbTime = 0;
        function _createXhrData(cancelReason){
            if (_this.readyState == 4) {
                var _aopData = _this._aopData;
                
                if(_aopData){
                    if(_this.readyState == 4){
                        _aopData.end = now();
                        _aopData.status = _this.status;
                        if (
                            _this.responseType == '' ||
                            _this.responseType == 'text'
                        ) {
                            _aopData.responseLength = getResourceLength(
                                _this.responseText
                            );
                        }
                    }
                    else if(_this.response){
                         _aopData.responseLength = getResourceLength(_this.response);
                    }
                    else{
                        try {
                            _aopData.responseLength = getResourceLength(
                                _this.responseText
                            );
                        } catch (e) {
                            _aopData.responseLength = 0;
                        }
                    }
                    _aopData.readyState = _this.readyState;
                    
                    //  数据的收集。。。       
                    var xhrItem = {
                        method: '',
                        url: '',
                        timeDiff:'',
                        status: '',
                        responseLength: '',
                        requestLength: '',
                        errorReason: '',
                        cbTime: '',
                        start: '',
                    }
                
                    _xhrList.push(xhrItem);
                    _this._aopData = null;
                }
                
            }
        }
        
        function _aopReadyStateChange(_event){
            return function(){
                var endTime;
                if (_this.readyState == 4 && _this._openWrap) {
                    endTime = now();
                    _this._aopData.readyState = 4;
                    _this._aopData.end = endTime;
                }
                try{
                    _event.apply(this, arguments);
                }
                catch(e){
                    
                }
                if (_this.readyState == 4) {
                    tempCbTime = now() - endTime; // 
                }
                
                _createXhrData();   
            }
        }
        //  
        if(!this._aop){
           aop(this,'onreadystatechange',_aopReadyStateChange)
           
           
           aop(this,'loadstart',function(){
                if (_this._aopData) {
                    _this._aopData.start = now();
                }
           });
           
           aop(this,'error',function(){
                if (_this._aopData) {
                    _createXhrData('error');
                }
           });
           
           aop(this,'abort',function(){
                if (_this._aopData) {
                    _createXhrData('abort');
                }
           });
           
           // 
            aop(this,'timeout',function(){
                if (_this._aopData) {
                    _createXhrData('timeout');
                }
            });
        } 
         
         
        try {
            return event.apply(this, arguments);
        } catch (e) {
            return Function.prototype.apply.call(event, this, arguments);
        }
     }
 })

```



## JS错误

主要收集的信息有
- 当前时间
- 行号
- 列号
- 错误信息
- 错误堆栈
- 出错页面或者引用脚本的URL
- 引用页面的URL
- 浏览器的基本信息


主要是通过 监听 window.onerror 实现

```javascript
// 代码
window.addEventListener('error',function(){
    
},false);

```

## 浏览器监测

主要是利用performance 的 Navigation Timing API 收集 浏览器的信息。

主要收集的信息
- 白屏时间
- 首次交互时间
- 开始时间
- 浏览器准备好使用 HTTP 请求抓取文档的时间 (fetchStart)
- HTTP 请求读取真实文档开始的时间（完成建立连接），包括从本地读取缓存,连接错误重连时，这里显示的也是新建立连接的时间 (requestStart)
- HTTP 开始接收响应的时间（获取到第一个字节），包括从本地读取缓存(responseStart)
- HTTP 响应全部接收完成的时间（获取到最后一个字节），包括从本地读取缓存(responseEnd)
- DOM 解析完成后，网页内资源加载开始的时间,文档发生 DOMContentLoaded事件的时间(domContentLoadedEventStart)
- DOM 解析完成后，网页内资源加载完成的时间（如 JS 脚本加载执行完毕），文档的DOMContentLoaded 事件的结束时间 (domContentLoadedEventEnd)
- 完成解析 DOM 树的时间，Document.readyState 变为 interactive，并将抛出 readystatechange 相关事件 (domInteractive)
- DOM 树解析完成，且资源也准备就绪的时间，Document.readyState 变为 complete，并将抛出 readystatechange 相关事件 (domComplete)
- load 事件发送给文档，也即 load 回调函数开始执行的时间,如果没有绑定 load 事件，值为 0 (loadEventStart)
- load 事件的回调函数执行完毕的时间,如果没有绑定 load 事件，值为 0 (loadEventEnd)
- 前一个网页（与当前页面同域）unload 的时间戳，如果无前一个网页 unload 或者前一个网页与当前页面不同域，则值为 0 (unloadEventStart)
- 和 unloadEventStart 相对应，返回前一个网页 unload 事件绑定的回调函数执行完毕的时间戳 (unloadEventEnd)
- 第一个 HTTP 重定向发生时的时间。有跳转且是同域名内的重定向才算，否则值为 0 (redirectStart)
- 最后一个 HTTP 重定向完成时的时间。有跳转且是同域名内的重定向才算，否则值为 0 (redirectEnd)
- HTTP（TCP） 开始建立连接的时间，如果是持久连接，则与 fetchStart 值相等,如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接开始的时间 ( connectStart)
- HTTP（TCP） 完成建立连接的时间（完成握手），如果是持久连接，则与 fetchStart 值相等,如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接完成的时间 (connectEnd)
- HTTPS 连接开始的时间，如果不是安全连接，则值为 0 (secureConnectionStart)


主要是通过利用window.performance 提供的api 获取数据信息。


### 白屏时间的实现

白屏时间计算方式为：
1. 获取浏览器的firstPaintTime
2. head头中最慢资源的时间（如果异步加载的情况下，会存在问题。）
3. head头中无资源文件时，取domloading时间
依次获取上述时间，优先取到的作为白屏时间

#### 代码实现

首先定义个数组，用来存储head头部资源数据。
```javascript

var _headerResourceList = [];

```


监听 DOMContentLoaded 事件，然后获取到当前 head 头部的 资源数据。存储起来。
```javascript

// 
documennt.addEventListener('DOMContentLoaded',function()}{
    if (document.querySelectorAll) {
        var _resources = document.querySelectorAll('head>link,head>script') || [];
        
        for(var i = 0;i<_resources.length;i++){
            var resource = _resources[i];
            var url = '';
            if (resource.tagName == 'LINK') {
                url = resource.href;
            } else if (
                resource.tagName == 'SCRIPT' &&
                !resource.defer &&
                !resource.async
            ) {
                url = resource.src;
            }

            if (url) {
                _headerResourceList.push(url);
            }
        }    
    }
},false);

```


// 
```javascript

function getFirstPaintTime(){
    var result = 0;

    if (performance) {
        var timing = performance.timing;

        if (performance.getEntriesByName) {
            result = timing.domLoading; // domloading 时间。
            var startTime = timing.navigationStart;
            
            for(var i = 0;i<_headerResourceList.length;i++){
                var resourceUrl = _headerResourceList[i];
                var resourceItem = performance.getEntriesByName(resourceUrl);
                if (resourceItem.length == 1) {
                    var timestamp = resourceItem[0].responseEnd + startTime;
                    if (timestamp > result) {
                        result = timestamp;
                    }
                }
            }
        }
    }
    return Math.round(result);
}

```


// 优先级 浏览器的firstPaintTime > header头部最慢资源 > domLoading 时间。
```javascript

var firstPaintTime;
var timing = performance.timing;
var _headerResourceList = [];

if (timing.msFirstPaint) {
    firstPaintTime = timing.msFirstPaint;
} else if (window.chrome && window.chrome.loadTimes) {
    var loadTime = window.chrome.loadTimes();
    if (loadTime && loadTime.firstPaintTime) {
        firstPaintTime = 1000 * loadTime.firstPaintTime;
    }
} else {
    firstPaintTime = getFirstPaintTime();
}
```


### 首次交互时间的实现

主要是监听 scroll，keypress，click 事件，然后设置首次交互时间。

```javascript

var _firstTouchTime = null;

// 设置第一次交互时间
function setFirstTouchTime() {
    if (!_firstTouchTime) {
        _firstTouchTime = new Date().getTime();;
    }
}

// 监听 scroll 事件
document.addEventListener('scroll',function(){
    setFirstTouchTime();
},false);

// 监听 keypress 事件
document.addEventListener('keypress',function(){
    setFirstTouchTime();
},false);

// 监听 click 事件
document.addEventListener('click',function(){
    
},false);


```

## 慢页面追踪

主要是利用 performance 的 Resource Timing API 来收集页面资源。

主要收集的信息
- 开始时间
- 资源类型
- 资源名称
- 开始时间
- fetchStart 
- domainLookupStart
- domainLookupEnd
- connectStart
- connectEnd
- secureConnectionStart
- requestStart
- responseStart
- responseEnd
- encodedBodySize
- transferSize

主要是通过利用window.performance 提供的api 获取数据信息。

```javascript
// 代码
var resourceList = [];

//
window.performance.addEventListener('resourcetimingbufferfull',function(){
    // 收集 数据
    if (performance.getEntriesByType) {
        var resource = performance.getEntriesByType('resource');
        if (resource) {
            resourceList = resourceList.concat(
                resource
            );
        }

        performance.clearResourceTimings();
    }
})
// 为了兼容其他浏览器，还需要同步监听 webkitresourcetimingbufferfull 事件。
```

然后通过分析 resourceList 数组里面的数据，就可以分析资源数据了。


## 区域分析
可以通过百度地图的API 来获取当前所在的位置。然后反向分析。
需要服务器端解析用户请求的IP地址


## 运营商分析
需要服务器端解析用户请求的IP地址。


## 接入方式
如果是微信环境，可以获取当前网络的接入方式 2G/3G/4G/WiFi等。

```
Mozilla/5.0 (Linux; Android 6.0; 1503-M02 Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Mobile MQQBrowser/6.2 TBS/036558 Safari/537.36 MicroMessenger/6.3.25.861 NetType/WIFI Language/zh_CN
```
根据 NetType 来获取到网络接入方式。

## 数据上报的时机

数据可能被上报的时机有

- 整个页面加载完成后上传 (onload事件)
- 离开页面时上传(pagehide事件)
- 发生js错误上传(onerror事件)
- 有Ajax请求上传(需要AOP XMLHttpRequest 对象)


```javascript
// 
window.addEventListener('load',function(){
    // handle page load 
},false);
```

```javascript
// 
window.addEventListener('pagehide',function(){
    // handle page leave 
},false)


// 
window.addEventListener('unload',function(){
    // handle page leave 
},false)


// 
window.addEventListener('beforeunload',function(){
    // handle page leave 
},false)


```

## 搜索引擎分析
通过分析页面的上面的参数，来分析是哪个搜索平台过来的。

分析的参数有
- utm_source 
- utm_medium
- utm_term
- utm_content
- utm_campaign

## 异步请求接口

根据上述分析，需要提供基本四个ajax请求
- 发送页面性能分析
- 发送页面资源分析
- 发送ajax分析
- 发送错误分析





