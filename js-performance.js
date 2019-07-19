/*
 * author:
 * date: 2018/1/12
 * desc: web 端性能监控 上传。
 */
!(function () {
    var _version = '0.0.1'; // 当前js 版本
    var performance = window.performance
        ? window.performance
        : window.Performance; // performance
    var _ua = navigator.userAgent; // UA
    var _fuckIe = new Function('return!+[1,]')(); // ie8-
    var SN_DATA = 'DATA'; // localstorege 存储 获取页面基本信息
    var SESSION_ID = 'SESSION_ID'; // session id 存储在cookie 里面的 标识会话的信息。
    var DISTINCT_ID = 'DISTINCT_ID'; // distinct id 存储在 localstorage 里面的标识人的信息。

    var _pageLoadTime = null; // 页面 load 时间。
    var _errorList = []; // error 错误队列
    var _xhrList = []; // xhr 性能列表
    var _performanceResourceTimingBufferList = []; // 资源 性能分析 数组
    var _firstTouchTime = null; // 用户的第一个动作发生时间(第一次交互时间)
    var _initDomLoadTime = null; // dom加载完毕时间
    var _lastSendTime = null; // ajax 聚集10s 之后或者 收集超过10条之后 就可以再次发送。
    var _sendxhrInterval = null; // 间隔发送 xhr interval
    var _sendXhrTimeout = 2 * 1000; // 间隔尝试发送 xhr 的时间差
    var _sendErrorInterval = null; // 间隔尝试发送 error interval
    var _sendErrorTimeout = 10 * 1000; // 间隔发送 error 的时间差
    var _performanceSendEnd = false; // 是否已经发送过页面性能分析(保证只发送一次页面性能分析数据)
    var _currentWrapFunc = null; //
    var _startTime = now(); // 初始化当前时间
    var _headerResourceList = []; // head 头部资源列表，用户计算白屏时间
    var _xhrincreaseId = 0; // xhr自增id;
    var _pfTime = now(); //
    var _needSendPf = false; //
    // 配置各种环境的地址。(烧制env)
    var _defaultHost = ""; // host
    var _performanceUrl = '/performance.gif'; // 页面性能
    var _resourcePerformanceUrl = '/resource.gif'; // 页面资源
    var _xhrUrl = '/xhr.gif'; // ajax
    var _errorUrl = '/error.gif'; // error

    // performance timing
    var PERFORMANCE_TIMING = {
        navigationStart: 'navigationStart',
        unloadEventStart: 'unloadEventStart',
        unloadEventEnd: 'unloadEventEnd',
        redirectStart: 'redirectStart',
        redirectEnd: 'redirectEnd',
        fetchStart: 'fetchStart',
        domainLookupStart: 'domainLookupStart',
        domainLookupEnd: 'domainLookupEnd',
        connectStart: 'connectStart',
        connectEnd: 'connectEnd',
        secureConnectionStart: 'secureConnectionStart',
        requestStart: 'requestStart',
        responseStart: 'responseStart',
        responseEnd: 'responseEnd',
        domLoading: 'domLoading',
        domInteractive: 'domInteractive',
        domContentLoadedEventStart: 'domContentLoadedEventStart',
        domContentLoadedEventEnd: 'domContentLoadedEventEnd',
        domComplete: 'domComplete',
        loadEventStart: 'loadEventStart',
        loadEventEnd: 'loadEventEnd',
    };

    // pvid
    var _pvid = (function () {
        function t() {
            return ((65536 * (1 + Math.random())) | 0).toString(16).substring(1);
        }

        return t() + '-' + t() + t();
    })();

    // 是否支持 localstorage
    var isSupportLocalStorage = (function () {
        var result = false;

        try {
            window.localStorage && window.localStorage.setItem(_pvid, _pvid);
            window.localStorage && window.localStorage.removeItem(_pvid);
            result = true;
        } catch (e) {
            result = false;
        }

        return result;
    })();

    // set/ get  cookie
    function _cookie(key, value, options) {
        if (!isUndefined(value)) {
            options = options || {};
            if (value === null) {
                value = '';
                options.expires = -1;
            }

            var expires = '';
            if (
                options.expires &&
                (typeof options.expires == 'number' || options.expires.toUTCString)
            ) {
                var data;
                if (typeof options.expires == 'number') {
                    data = new Date();
                    data.setTime(data.getTime() + options.expires * 24 * 60 * 60 * 1000);
                } else {
                    data = options.expires;
                }
                expires = '; expires=' + data.toUTCString();
            }
            var path = options.path ? '; path=' + options.path : '';
            var domain = options.domain ? '; domain=' + options.domain : '';
            var secure = options.secure ? '; secure' : '';
            document.cookie = [
                key,
                '=',
                encode(value),
                expires,
                path,
                domain,
                secure,
            ].join('');
        } else {
            var cookieValue = null;

            if (document.cookie && document.cookie != '') {
                var cookies = document.cookie.split(';');
                for (var i = 0; i < cookies.length; i++) {
                    var cookie = trim(cookies[i]);
                    // get
                    if (cookie.substring(0, key.length + 1) === key + '=') {
                        cookieValue = decode(cookie.substring(key.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        }
    }

    /*
     * -------------------------utils start-------------------------------------------
     * */

    function getXhrIncreaseId() {
        return _xhrincreaseId++;
    }

    // json parse
    function parse(string) {
        var result = {};
        try {
            if (window.JSON) {
                result = JSON.parse(string);
            } else {
                //
                function _parse(str) {
                    return new Function('return' + str);
                }

                result = _parse(string);
            }
        } catch (e) {
        }
        return result;
    }

    // stringify
    function stringify(obj) {
        var result = '';
        try {
            if (window.JSON) {
                result = JSON.stringify(obj);
            } else {
                result = toString(obj);
            }
        } catch (e) {
        }

        return result;
    }

    // trim
    function trim(str) {
        var _trim = String.prototype.trim;
        var func = _trim
            ? function (s) {
                return null === s ? '' : _trim.call(s);
            }
            : function (s) {
                return null === s
                    ? ''
                    : s
                        .toString()
                        .replace(/^\s+/, '')
                        .replace(/\s+$/, '');
            };
        return func(str);
    }

    function noop(a, b, c, d) {
    }

    function isFunction(func) {
        return typeof func === 'function';
    }

    function isBoolean(obj) {
        return typeof obj === 'boolean';
    }

    function isUndefined(obj) {
        return typeof obj === 'undefined';
    }

    function isString(str) {
        return typeof str === 'string';
    }

    function getCookie(key) {
        return _cookie(key);
    }

    function setCookie(key, value, options) {
        _cookie(key, value, options);
    }

    function toString(obj) {
        switch (typeof obj) {
            case 'object':
                if (!obj) {
                    return 'null';
                }
                var i;
                var j;

                //
                if (obj instanceof Array) {
                    for (i = '[', j = 0; j < obj.length; j++) {
                        i += (j > 0 ? ',' : '') + toString(obj[j]);
                    }
                    return i + ']';
                }

                //
                if (obj instanceof Date) {
                    return obj.getTime().toString();
                }

                i = '{';
                var index = 0;
                for (var n in obj) {
                    //
                    if ('function' != typeof obj[n]) {
                        var it = toString(obj[n]);
                        i += (index > 0 ? ',' : '') + toString(n) + ':' + it;
                        index++;
                    }
                }
                return i + '}';

            case 'string':
                return (
                    '"' + obj.replace(/([\"\\])/g, '\\$1').replace(/\n/g, '\\n') + '"'
                );
            case 'number':
                return obj.toString();
            case 'boolean':
                return obj ? 'true' : 'false';
            case 'function':
                return toString(obj.toString());
            case 'undefined':
                return '"undefined"';
            default:
                return '"undefined"';
        }
    }

    function isObjectEmpty(obj) {
        for (var i in obj) {
            return false;
        }
        return true;
    }

    function encode(str) {
        var result = str;
        try {
            result = encodeURIComponent ? encodeURIComponent(str) : str;
        } catch (e) {
        }
        return result;
    }

    function decode(str) {
        var result = str;
        try {
            result = decodeURIComponent ? decodeURIComponent(str) : str;
        } catch (e) {
        }
        return result;
    }

    function now() {
        return new Date().getTime();
    }

    function each(list, iteratee) {
        list = list || [];
        if (list && list.length > 0) {
            for (var i = 0; i < list.length; i++) {
                if (list[i]) {
                    iteratee(list[i], i, list);
                }
            }
        }
    }

    function getArgumentsArray() {
        var result = [];
        for (var i = 0, len = arguments.length; i < len; i++) {
            result.push(arguments[i]);
        }
        return result;
    }

    // customHeader 是为了兼容业务异常上报 不能修改 content-type的问题
    function post(url, data, headers, callback, customHeader) {
        if (!url) {
            return false;
        }

        if (isFunction(headers)) {
            callback = headers;
            headers = null;
        }

        data = data || '';

        callback = isFunction(callback) ? callback : noop;

        if (window.navigator && window.navigator.sendBeacon && /^http/i.test(url) && !customHeader) {
            // https://developer.mozilla.org/zh-CN/docs/Web/API/Navigator/sendBeacon
            var response = window.navigator.sendBeacon(url, data);
            callback(!response);
        } else {
            var request;

            // ie10 支持跨域资源共享(CORS)访问
            if (window.XDomainRequest) {
                request = new XDomainRequest();

                request.open('POST', url);

                //
                request.onload = function () {
                    callback(null, request.responseText);
                };

                //
                addEventListener(request, 'load', function () {
                    callback(null, request.responseText);
                });

                //
                addEventListener(request, 'error', function () {
                    callback('post(' + url + ') error');
                });

                wrap(true, request, 'onerror', function (event) {
                    return function () {
                        callback('post error', request.responseText);

                        if (isFunction(event)) {
                            event.apply(this, arguments);
                        }
                    };
                });

                request.send(data);
            }
            //
            else {
                //
                if (window.XMLHttpRequest) {
                    request = new window.XMLHttpRequest();
                    if (request.overrideMimeType) {
                        request.overrideMimeType('text/html');
                    }
                    // ?
                    try {
                        // 排除自己被自己捕获住。。。
                        request._wrap = 1;
                    } catch (e) {
                    }

                    request.onreadystatechange = function (ev) {
                        if (request.readyState === 4 && request.status === 200) {
                            callback(null, request.responseText);
                        }
                    };

                    // 如果支持 onerror 方法
                    if (request.onerror) {
                        //
                        wrap(true, request, 'onerror', function (event) {
                            return function () {
                                callback('post err', request.responseText);

                                if (isFunction(event)) {
                                    event.apply(this, arguments);
                                }
                            };
                        });
                    }

                    //
                    try {
                        // 异步请求
                        request.open('POST', url, true);
                    } catch (e) {
                    }

                    //  设置请求头部
                    for (var prop in headers) {
                        request.setRequestHeader(prop, headers[prop]);
                    }

                    request.send(data);
                } else {
                    callback(false);
                }
            }
        }
    }

    function wrap(flag, target, key, callback, options) {
        var _event;
        try {
            _event = target[key]; // 原始的 value
        } catch (e) {
            if (!flag) {
                return false;
            }
        }
        //  flag
        if (!_event && !flag) {
            return false;
        }

        // 已经封装过了
        if (_event && _event._wrap) {
            return false;
        }

        try {
            target[key] = callback(_event, options);
        } catch (e) {
            return false;
        }

        // 封装过了对象
        target[key]._wrap = [_event];
        return true;
    }

    function unWrap(target, key) {
        try {
            var _event = target[key]._wrap;
            //
            if (_event) {
                target[key] = _event[0];
                // 设置 _wrap 为 null
                target[key]._wrap = null;
                // 删除 _wrap
                delete target[key]._wrap;
            }
        } catch (e) {
        }
    }

    function wrapTimeout(name) {
        each(['setTimeout', 'setInterval'], function (item) {
            //
            wrap(true, window, item, function (it) {
                return function () {
                    var temp;
                    var args = getArgumentsArray.apply(this, arguments);
                    var arg0 = args[0];

                    if (isFunction(arg0)) {
                        temp = wrapFunction(arg0, name, true);
                    }

                    if (temp) {
                        args[0] = temp;
                    }

                    if (it.apply) {
                        it.apply(this, args);
                    } else {
                        Function.prototype.apply.apply(it, [it, args]);
                    }
                };
            });
        });
    }

    function unwrapTimeout() {
        each(['setTimeout', 'setInterval'], function (item) {
            unWrap(window, item);
        });
    }

    function wrapFunction(func, name, flag) {
        return function () {
            try {
                _currentWrapFunc = name;
                if (flag) {
                    wrapTimeout(name);
                }

                func.apply(this, arguments);

                if (flag) {
                    unwrapTimeout();
                }
            } catch (e) {
                if (flag) {
                    unwrapTimeout();
                }
            }
        };
    }

    function addEventListener(el, event, func, useCapture) {
        if (!el || !event) {
            return false;
        }

        func = isFunction(func) ? func : noop;

        useCapture = isBoolean(useCapture) ? useCapture : false;

        if (el.addEventListener) {
            try {
                el.addEventListener(event, func, useCapture);
            } catch (e) {
            }
        } else if (el.attachEvent) {
            try {
                el.attachEvent('on' + event, func);
            } catch (e) {
            }
        } else {
            el['on' + event] = func;
        }
    }

    // xxxxxxxx-xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    var uuid = (function () {
        function t(t) {
            return t < 0
                ? NaN
                : t <= 30
                    ? 0 | (Math.random() * (1 << t))
                    : t <= 53
                        ? (0 | (Math.random() * (1 << 30))) +
                        (0 | (Math.random() * (1 << (t - 30)))) * (1 << 30)
                        : NaN;
        }

        function e(t, e) {
            for (
                var r = t.toString(16), n = e - r.length, a = '0';
                n > 0;
                n >>>= 1, a += a
            )
                1 & n && (r = a + r);
            return r;
        }

        return function () {
            return (
                e(t(32), 8) +
                '-' +
                e(t(16), 4) +
                '-' +
                e(16384 | t(12), 4) +
                '-' +
                e(32768 | t(14), 4) +
                '-' +
                e(t(48), 12)
            );
        };
    })();

    function bind(func, context) {
        return function () {
            return func.apply(context, arguments);
        };
    }

    function setStorage(key, val, timeout) {
        if (isSupportLocalStorage) {
            bind(localStorage.setItem, localStorage);
            localStorage.setItem(key, val);
        } else {
            setCookie(key, val, {expires: timeout});
        }
    }

    function getStorage(key) {
        if (isSupportLocalStorage) {
            bind(localStorage.getItem, localStorage);
            return localStorage.getItem(key);
        } else {
            return getCookie(key);
        }
    }

    function makeUrl(url, path) {
        var protocol = /^https/i.test(document.URL) ? 'https' : 'http';
        var href = protocol + '://' + url;
        if (path) {
            href += path;
        }
        return href;
    }

    // 补全url
    function completeUrl(url) {
        url = url + '';
        var href = '';
        var protocol = /^https/i.test(document.URL) ? 'https' : 'http';
        var host = document.location.host;
        if (startsWith(url, 'http')) {
            return url;
        }

        // 如果以 // 打头
        if (startsWith(url, '//')) {
            href = protocol + ':' + url;
        }
        // 如果以 / 打头
        else if (startsWith(url, '/')) {
            href = protocol + '://' + host + url;
        }
        // 如果以 ../打头的
        else if (startsWith(url, '../')) {
            var _url = url.replace('../', '/');
            href = protocol + '://' + host + _url;
        } else {
            href = protocol + '://' + host + '/' + url;
        }

        return href;
    }

    //get resource length
    function getResourceLength(obj) {
        var result = '';
        if (typeof obj === 'string') {
            result = obj.length;
        } else if (window.ArrayBuffer && obj instanceof ArrayBuffer) {
            result = obj.byteLength;
        } else if (window.Blob && obj instanceof Blob) {
            result = obj.size;
        } else if (obj && obj.length) {
            result = obj.length;
        } else {
            result = 0;
        }

        return result;
    }

    function startsWith(str1, prefix) {
        var _startsWith = String.prototype.startsWith;
        var func = _startsWith
            ? function (s, p) {
                return s.startsWith(p);
            }
            : function (s, p) {
                return s.slice(0, p.length) === p;
            };

        return func(str1, prefix);
    }

    function formatError(errors) {
        var args = arguments;

        var argsLength = args.length;
        var result = {
            time: now(),
            lineno: 0, // 行号
            colno: 0, // 列号
            message: '', // 错误信息
            messageStack: '', // 错误堆栈
            fileName: '', // 出错的文件名
        };

        if (argsLength > 0) {
            /**
             * @param {String}  errorMessage   错误信息
             * @param {String}  scriptURI      出错的文件
             * @param {Long}    lineNumber     出错代码的行号
             * @param {Long}    columnNumber   出错代码的列号
             * @param {Object}  errorObj       错误的详细信息，Anything
             *
             */
            var errorMsg = args[0];
            if (isString(errorMsg)) {
                result.message = args[0];
                result.fileName = args[1];
                result.lineno = args[2];
                result.colno = args[3];
                result.messageStack = args[4];
            }
            // Error 错误类型
            else if (
                errorMsg instanceof Error ||
                (window.ErrorEvent && errorMsg instanceof window.ErrorEvent)
            ) {
                //
                if (errorMsg.message) {
                    result.message = errorMsg.message;
                }

                if (errorMsg.error) {
                    result.message =
                        errorMsg.error.constructor.name + (errorMsg.error.message || '');
                    result.messageStack = errorMsg.error.stack || '';
                }

                result.lineno = errorMsg.lineno || 0;
                result.colno = errorMsg.colno || 0;

                //
                if (errorMsg.filename) {
                    result.fileName = errorMsg.filename;
                } else if (errorMsg.error) {
                    result.fileName = errorMsg.error.fileName || '';
                } else if (errorMsg.target) {
                    result.fileName = errorMsg.target.baseURI || '';
                }
            }
        }
        return result;
    }

    // format system performance info
    function formatSysPerformanceInfo() {
        var result = {};
        var startTime = _startTime;
        if (performance && performance.timing) {
            var timing = performance.timing;
            startTime = timing.navigationStart; //

            //
            function _timeDifference(prop) {
                var temp = 0;
                var propTime = timing[prop];
                if (propTime) {
                    temp = propTime - startTime;
                }
                // 添加防御
                if (temp < 0) {
                    temp = 0;
                }
                return temp;
            }

            var domainLookupStartTime = _timeDifference(
                PERFORMANCE_TIMING.domainLookupStart
            );
            var domainLookupEndTime = _timeDifference(
                PERFORMANCE_TIMING.domainLookupEnd
            );
            var redirectStartTime = _timeDifference(PERFORMANCE_TIMING.redirectStart);
            var redirectEndTime = _timeDifference(PERFORMANCE_TIMING.redirectEnd);
            var connectStartTime = _timeDifference(PERFORMANCE_TIMING.connectStart);
            var connectEndTime = _timeDifference(PERFORMANCE_TIMING.connectEnd);

            result = {
                fetchStartTime: _timeDifference(PERFORMANCE_TIMING.fetchStart),
                requestStartTime: _timeDifference(PERFORMANCE_TIMING.requestStart),
                responseStartTime: _timeDifference(PERFORMANCE_TIMING.responseStart),
                responseEndTime: _timeDifference(PERFORMANCE_TIMING.responseEnd),
                domContentLoadedEventStartTime: _timeDifference(
                    PERFORMANCE_TIMING.domContentLoadedEventStart
                ),
                domContentLoadedEventEndTime: _timeDifference(
                    PERFORMANCE_TIMING.domContentLoadedEventEnd
                ),
                domInteractiveTime: _timeDifference(PERFORMANCE_TIMING.domInteractive),
                domCompleteTime: _timeDifference(PERFORMANCE_TIMING.domComplete),
                loadEventStartTime: _timeDifference(PERFORMANCE_TIMING.loadEventStart),
                loadEventEndTime: _timeDifference(PERFORMANCE_TIMING.loadEventEnd),
                unloadEventStartTime: _timeDifference(
                    PERFORMANCE_TIMING.unloadEventStart
                ),
                unloadEventEndTime: _timeDifference(PERFORMANCE_TIMING.unloadEventEnd),
            };

            // tcp 时间
            if (connectEndTime - connectStartTime >= 0) {
                result.connectStartTime = connectStartTime;
                result.connectEndTime = connectEndTime;
            }

            //
            if (domainLookupEndTime - domainLookupStartTime >= 0) {
                result.domainLookupStartTime = domainLookupStartTime;
                result.domainLookupEndTime = domainLookupEndTime;
            }

            // 重定向时间
            if (redirectEndTime - redirectStartTime >= 0) {
                result.redirectEndTime = redirectEndTime;
                result.redirectStartTime = redirectStartTime;
            }

            var firstPaintTime;

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

            // 白屏时间
            if (firstPaintTime) {
                result.firstPaintTime = Math.round(firstPaintTime - startTime);
            }

            // 首次交互时间
            if (_firstTouchTime) {
                result.firstTouchTime = Math.round(_firstTouchTime - startTime);
            }

            if (timing.secureConnectionStart) {
                result.secureConnectionStartTime = _timeDifference(
                    PERFORMANCE_TIMING.secureConnectionStart
                );
            }
        } else {
            result = {
                domContentLoadedEventStartTime: _initDomLoadTime - startTime,
                loadEventStartTime: _pageLoadTime - startTime,
                loadEventEndTime: _pageLoadTime - startTime
            };
        }

        return result;
    }

    // format resource performance info
    function formatResourcePerformanceInfo(loadEventStart) {
        var result = [];

        var resource;

        // 必须满足慢页面的时候才会分析 资源信息。
        if (performance) {
            if (performance.getEntriesByType) {
                resource = performance.getEntriesByType('resource');
            }

            if (performance.getEntries) {
                resource = performance.getEntries();
            }

            // 如果资源存在的话
            if (resource) {
                _performanceResourceTimingBufferList = _performanceResourceTimingBufferList.concat(
                    resource
                );
            }

            if (performance.webkitClearResourceTimings) {
                performance.webkitClearResourceTimings();
            }

            if (performance.clearResourceTimings) {
                performance.clearResourceTimings();
            }

            //
            for (
                var i = 0, len = _performanceResourceTimingBufferList.length;
                i < len;
                i++
            ) {
                var resourceItem = _performanceResourceTimingBufferList[i];
                var resourceObj = {
                    startTime: resourceItem.startTime || 0,
                    initiatorType: resourceItem.initiatorType,
                    name: encode(resourceItem.name),
                    fetchStartTime: resourceItem.fetchStart || 0,
                    domainLookupStartTime: resourceItem.domainLookupStart || 0,
                    domainLookupEndTime: resourceItem.domainLookupEnd || 0,
                    connectStartTime: resourceItem.connectStart || 0,
                    connectEndTime: resourceItem.connectEnd || 0,
                    secureConnectionStartTime: resourceItem.secureConnectionStart || 0,
                    requestStartTime: resourceItem.requestStart || 0,
                    responseStartTime: resourceItem.responseStart || 0,
                    responseEndTime: resourceItem.responseEnd || 0,
                    encodedBodySize: resourceItem.encodedBodySize || 0,
                    transferSize: resourceItem.transferSize || 0,
                };

                // 是否慢资源
                var isSlowResource =
                    resourceObj.responseEndTime - resourceObj.startTime >
                    defaultConfig.slowResourceT;

                if (isSlowResource) {
                    if (getRandom() <= defaultConfig.slowResourceP) {
                        result.push(resourceObj);
                    }
                } else {
                    if (
                        loadEventStart > defaultConfig.slowPageT &&
                        getRandom() <= defaultConfig.slowP
                    ) {
                        result.push(resourceObj);
                    }
                }
            }
        }
        return result;
    }

    // 设置第一次交互时间
    function setFirstTouchTime() {
        if (!_firstTouchTime) {
            _firstTouchTime = now();
        }
    }

    // dom 是否初始化，监听 DOMContentLoaded 事件
    function hasDomInited() {
        return !!_initDomLoadTime;
    }

    // load event 监听 load 事件
    function ready() {
        return !!_pageLoadTime;
    }

    function getDistinctId() {
        return getStorage(DISTINCT_ID);
    }

    function getSessionId() {
        return getCookie(SESSION_ID);
    }

    function uuid32() {
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0,
                v = c == 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    function getCommonParam() {
        var version = defaultConfig.version;
        var key = defaultConfig.key;
        var ref = encode(document.URL);
        var rand = now();
        var pvid = _pvid;
        var distinctId = encode(getDistinctId());
        var sessionId = encode(getSessionId());
        var title = encode(document.title);
        var charset = document.characterSet;
        var pageInfo = _getPageInfo() || {};

        //
        var result = {
            v: version, // 当前版本号
            k: key, // 当前应用的id(服务器端生成的应用id)
            cref: ref, // 当前url 地址
            r: rand, // 时间戳 随机数
            p: pvid, // pv id 每次访问都会重新生成
            d: distinctId, //客户端缓存id
            s: sessionId, // 当前回话id
            tit: title, // 当前页面的标题
            c: charset, // 当前页面的编码
            pref: pageInfo.pageRef, //  来源页面
            firstd: pageInfo.isFirstDay, // 是否第一次访问页面
            firstt: pageInfo.isFirstTime, // 是否当天第一次访问该页面
            lg: pageInfo.browserLanguage, // 当前页面的语言
            sw: pageInfo.screenWidth, // 当前屏幕的宽度
            sh: pageInfo.screenHeight, // 当前屏幕的高度
            ua: encode(_ua), // 浏览器 UA 信息
        };

        return result;
    }

    function getRandom() {
        return Math.floor(Math.random() * 100 + 1);
    }

    // 获取白屏时间
    function getFirstPaintTime() {
        var result = 0;

        if (performance) {
            var timing = performance.timing;

            if (performance.getEntriesByName) {
                result = timing.domLoading;
                var startTime = timing.navigationStart;

                each(_headerResourceList, function (resourceUrl) {
                    var resourceItem = performance.getEntriesByName(resourceUrl);
                    if (resourceItem.length == 1) {
                        var timestamp = resourceItem[0].responseEnd + startTime;

                        if (timestamp > result) {
                            result = timestamp;
                        }
                    }
                });
            }
        }
        return Math.round(result);
    }

    /*
     * -------------------------utils end-------------------------------------------
     * */

    /**
     * bind event start
     */

    var _hasLeave = false;

    // 监听页面离开
    function _handlePageLeave() {
        if (!_hasLeave) {
            _performanceSend();
        }

        if (_sendxhrInterval) {
            clearInterval(_sendxhrInterval);
            _sendxhrInterval = null;
        }

        if (_sendErrorInterval) {
            clearInterval(_sendErrorInterval);
            _sendErrorInterval = null;
        }

        _hasLeave = true;
    }

    // 监听 load 事件
    function _handlePageLoad() {
        if (!_pageLoadTime) {
            _pageLoadTime = now();
            _initDomLoad();

            // 如果没有 则去拉去完数据之后，再发送性能分析数据。
            setTimeout(function () {
                _performanceSend();
            }, 0);
        }
    }

    /**
     * @param {String}  errorMessage   错误信息
     * @param {String}  scriptURI      出错的文件
     * @param {Long}    lineNumber     出错代码的行号
     * @param {Long}    columnNumber   出错代码的列号
     * @param {Object}  errorObj       错误的详细信息，Anything
     *
     */
    function _handleWindowError() {
        //
        if (getRandom() <= defaultConfig.jsErrorP) {
            var errorObj = formatError.apply(this, arguments);
            if (errorObj.fileName) {
                _errorList.push(errorObj);
            }
        }
    }

    // 初始化结束，监听 DOMContentLoaded 事件
    function _initDomLoad() {
        if (!_initDomLoadTime) {
            _initDomLoadTime = now();
            //
            if (document.querySelectorAll) {
                var _resources =
                    document.querySelectorAll('head>link,head>script') || [];

                each(_resources, function (resource) {
                    var url = '';
                    if (resource.tagName === 'LINK') {
                        url = resource.href;
                    } else if (
                        resource.tagName === 'SCRIPT' &&
                        !resource.defer &&
                        !resource.async
                    ) {
                        url = resource.src;
                    }

                    if (url) {
                        _headerResourceList.push(url);
                    }
                });
            }

            _sendxhrInterval = setInterval(function () {
                _ajaxSend();
            }, _sendXhrTimeout);
        }
    }

    /*
     * bind event end
     * */

    // 格式化 performance 数据
    function _formatSysPerformanceData(pagePerformance) {
        var commonData = getCommonParam();
        pagePerformance = pagePerformance || {};
        commonData.r = _pfTime;
        //
        var pageData = {
            dc: pagePerformance.domCompleteTime || 0,
            di: pagePerformance.domInteractiveTime || 0,
            dclee: pagePerformance.domContentLoadedEventEndTime || 0,
            dcles: pagePerformance.domContentLoadedEventStartTime || 0,
            fs: pagePerformance.fetchStartTime || 0,
            led: pagePerformance.loadEventEndTime || 0,
            les: pagePerformance.loadEventStartTime || 0,
            reqs: pagePerformance.requestStartTime || 0,
            rsps: pagePerformance.responseStartTime || 0,
            rspe: pagePerformance.responseEndTime || 0,
            uee: pagePerformance.unloadEventEndTime || 0,
            ues: pagePerformance.unloadEventStartTime || 0,
            fp: pagePerformance.firstPaintTime || 0,
            dls: pagePerformance.domainLookupStartTime || 0,
            dle: pagePerformance.domainLookupEndTime || 0,
            ft: pagePerformance.firstTouchTime || 0,
            scs: pagePerformance.secureConnectionStartTime || 0,
            cs: pagePerformance.connectStartTime || 0,
            ce: pagePerformance.connectEndTime || 0,
            rde: pagePerformance.redirectEndTime || 0,
            rds: pagePerformance.redirectStartTime || 0,
        };

        //
        var result = {
            common: commonData,
            page: pageData,
        };

        return result;
    }

    function _formatResourcePerformanceData(resourcePerformanceList) {
        var commonData = getCommonParam();
        resourcePerformanceList = resourcePerformanceList || [];

        var resourceListData = [];
        var result = {
            common: commonData,
            resources: [],
        };
        //
        for (var i = 0, len = resourcePerformanceList.length; i < len; i++) {
            var item = resourcePerformanceList[i];
            var resourceData = {
                n: item.name,
                type: item.initiatorType,
                start: Math.round(item.startTime),
                ce: Math.round(item.connectEndTime),
                cs: Math.round(item.connectStartTime),
                dls: Math.round(item.domainLookupStartTime),
                dle: Math.round(item.domainLookupEndTime),
                fs: Math.round(item.fetchStartTime),
                reqs: Math.round(item.requestStartTime),
                rspe: Math.round(item.responseEndTime),
                rsps: Math.round(item.responseStartTime),
                scs: Math.round(item.secureConnectionStartTime),
                bs: item.encodedBodySize,
                ts: item.transferSize,
                s: '200', // 写死200
            };

            resourceListData.push(resourceData);
        }

        if (resourceListData.length > 0) {
            result.resources = resourceListData;
        }

        return result;
    }

    // 格式化 error 数据
    function _formatErrorData() {
        var commonData = getCommonParam();
        commonData.r = _pfTime;
        //
        var result = {
            common: commonData,
            errors: [],
        };

        //
        for (var i = 0, len = _errorList.length; i < len; i++) {
            var item = _errorList[i];
            var temp = {
                time: item.time,
                cno: item.colno,
                lno: item.lineno,
                name: item.fileName,
                msg: item.message,
                msgStack: item.messageStack,
            };
            result.errors.push(temp);
        }

        return result;
    }

    // 格式化 xhr 数据
    function _formatXHRData() {
        var commonData = getCommonParam();
        var result = {
            common: commonData,
            xhr: [],
        };
        var slowXhrList = [];
        var xhrList = [];
        for (var i = 0, len = _xhrList.length; i < len; i++) {
            var item = _xhrList[i];
            var temp = {
                id: item.id,
                start: item.start,
                err: item.errorReason,
                m: item.method,
                reql: item.requestLength || 0,
                resl: item.responseLength || 0,
                s: item.status,
                diff: item.timeDiff,
                tid: item.traceId,
                u: item.url,
                at: item.cbTime, // ajax回调执行时间
            };

            // 慢ajax
            if (
                temp.diff > defaultConfig.slowAjaxT &&
                getRandom() <= defaultConfig.slowAjaxP
            ) {
                slowXhrList.push(temp);
            } else if (temp.err || (temp.s !== 200 && temp.s !== 0)) {
                if (getRandom() <= defaultConfig.ajaxErrorP) {
                    slowXhrList.push(temp);
                }
            }
            xhrList.push(temp);
        }

        if (slowXhrList.length > 0) {
            if (getRandom() <= defaultConfig.ajaxP) {
                result.xhr = xhrList;
            } else {
                result.xhr = slowXhrList;
            }
        } else {
            if (getRandom() <= defaultConfig.ajaxP) {
                result.xhr = xhrList;
            }
        }

        return result;
    }

    // 性能分析
    function _performanceSend() {
        if (_performanceSendEnd) {
            return false;
        }

        if (!ready()) {
            return false;
        }

        try {
            var pagePerformance = formatSysPerformanceInfo();

            if (!isObjectEmpty(performance)) {
                var resourcePerformance = formatResourcePerformanceInfo(
                    pagePerformance.loadEventStartTime > 0
                        ? pagePerformance.loadEventStartTime
                        : _pageLoadTime - _startTime
                );

                // 如果是正常页面的话
                if (resourcePerformance.length === 0) {
                    // 存在错误 也得上传。
                    if (_errorList.length > 0) {
                        _doSend();
                    } else {
                        // 按照正常采样率去收集数据
                        if (getRandom() <= defaultConfig.normalP || _needSendPf) {
                            _doSend();
                        }
                    }
                }
                // 慢页面全部上传
                else {
                    _doSend();
                }

                function _doSend() {
                    var sendData = _formatSysPerformanceData(pagePerformance);
                    var sourceData = _formatResourcePerformanceData(resourcePerformance);
                    post(makeUrl(_defaultHost, _performanceUrl), stringify(sendData));

                    if (sourceData.resources.length > 0) {
                        window.setTimeout(function () {
                            post(
                                makeUrl(_defaultHost, _resourcePerformanceUrl),
                                stringify(sourceData)
                            );
                        }, 100);
                    }
                    _performanceSendEnd = true;
                }

                //
                _errorSend();
                _sendErrorInterval = setInterval(function () {
                    _errorSend();
                }, _sendErrorTimeout);
            }
        } catch (e) {
        }
    }

    //
    function _ajaxSend(needImmediately) {
        //
        if (hasDomInited() || needImmediately) {
            //
            if (!needImmediately) {
                if (!_lastSendTime) {
                    needImmediately = true;
                } else {
                    needImmediately =
                        now() - _lastSendTime > 10000 || _xhrList.length >= 10;
                }
            }

            if (_xhrList.length > 0 && needImmediately) {
                var xhrData = _formatXHRData();
                if (xhrData.xhr.length > 0) {
                    _needSendPf = true;
                    post(makeUrl(_defaultHost, _xhrUrl), stringify(xhrData));
                }
                // send
                _lastSendTime = now();
                _xhrList = [];
            }
        }
    }

    // 错误信息发送
    function _errorSend() {
        //
        if (_errorList.length > 0) {
            _needSendPf = true;
            var errorData = _formatErrorData();
            post(makeUrl(_defaultHost, _errorUrl), stringify(errorData));
            // 置空操作
            _errorList = [];
        }
    }

    // 获取页面基本信息
    function _getPageInfo() {
        var data = getStorage(SN_DATA) || '';
        try {
            if (data) {
                data = parse(data);
            }
        } catch (e) {
        }

        return data;
    }

    // 采集 浏览器基本信息
    function _initBrowserInfo() {
        // 数据存储在 storage 里面
        var storage = getStorage(SN_DATA) || '';
        storage = parse(storage);

        var isFirstDay = 'isFirstDay'; // 是否第一天 访问
        var isFirstTime = 'isFirstTime'; // 是否第一次访问
        var firstDay = 'firstDay'; // 第一天的日期
        var timeout = 30; // 30 day

        // 格式化 日期信息
        function formatDayInfo(obj) {
            obj = obj || {};
            var _firstDay = obj[firstDay];
            if (_firstDay) {
                _firstDay = parseInt(_firstDay, 10);
                // 如果
                if (new Date(_firstDay).toDateString() === new Date().toDateString()) {
                    obj[isFirstDay] = true;
                } else {
                    obj[isFirstDay] = false;
                }

                obj[isFirstTime] = false;
            } else {
                obj[firstDay] = now();
                obj[isFirstDay] = true;
                obj[isFirstTime] = true;
            }
            return obj;
        }

        // 更新 day 相关字段
        storage = formatDayInfo(storage);

        storage['pageRef'] = document.referrer || '';
        storage['browserLanguage'] =
            navigator.language || navigator.browserLanguage;
        storage['screenHeight'] = window.screen && window.screen.height;
        storage['screenWidth'] = window.screen && window.screen.width;

        setStorage(SN_DATA, stringify(storage), timeout);
    }

    // 初始化 DISTINCT_ID  和  SESSION_ID
    function _initUserInfo() {
        var distinctId = getStorage(DISTINCT_ID);
        var sessionId = getCookie(SESSION_ID);

        if (!distinctId) {
            distinctId = uuid();
            setStorage(DISTINCT_ID, distinctId);
        }

        if (!sessionId) {
            sessionId = uuid();
            setCookie(SESSION_ID, sessionId);
        }
    }

    //
    function _wrapXMLHttpRequest() {
        var XHR = window.XMLHttpRequest;
        //
        if (XHR.prototype) {
            wrap(false, XHR.prototype, 'open', function (event) {
                return function () {
                    // 封装 wrap 方法
                    if (!this._wrap) {
                        var args = getArgumentsArray.apply(this, arguments);
                        this._openWrap = {
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
                };
            });

            //
            wrap(false, XHR.prototype, 'send', function (event) {
                return function () {
                    var _this = this;
                    var readyStatusChangeNextTime = 0;
                    var tempCbTime = 0;

                    // 创建一个 xhr 收集搜集对象
                    function _createXhrData(cancelReason) {
                        if (_this.readyState == 4) {
                            var _openWrap = _this._openWrap;
                            if (_openWrap) {
                                if (_this.readyState === 4) {
                                    _openWrap.end = now();
                                    _openWrap.status = _this.status;
                                    if (
                                        _this.responseType == '' ||
                                        _this.responseType == 'text'
                                    ) {
                                        _openWrap.responseLength = getResourceLength(
                                            _this.responseText
                                        );
                                    }
                                } else if (_this.response) {
                                    _openWrap.responseLength = getResourceLength(_this.response);
                                } else {
                                    try {
                                        _openWrap.responseLength = getResourceLength(
                                            _this.responseText
                                        );
                                    } catch (e) {
                                        _openWrap.responseLength = 0;
                                    }
                                }
                                //
                                _openWrap.readyState = _this.readyState;
                                var xhrItem = {
                                    method: ('' + _openWrap.method).toUpperCase(),
                                    url: completeUrl(_openWrap.url),
                                    timeDiff:
                                        _openWrap.status > 0 ? _openWrap.end - _openWrap.start : 0,
                                    status: _openWrap.status,
                                    responseLength: _openWrap.responseLength,
                                    requestLength: _openWrap.requestLength,
                                    errorReason:
                                        _openWrap.status == 0 ? cancelReason || 'error' : '',
                                    traceId: _openWrap.tradeId || '',
                                    cbTime: tempCbTime,
                                    id: getXhrIncreaseId(),
                                    start: _openWrap.start,
                                };
                                _xhrList.push(xhrItem);
                                _this._openWrap = null; // 移除掉wrap
                            }
                        }
                    }

                    // wrap ready state change 事件
                    function _wrapReadyStateChange(event) {
                        return function () {
                            var endTime;
                            if (_this.readyState == 4 && _this._openWrap) {
                                endTime = now();
                                _this._openWrap.readyState = 4;
                                _this._openWrap.end = endTime;
                            }

                            try {
                                if (_currentWrapFunc) {
                                    wrapTimeout(_currentWrapFunc);
                                }

                                event.apply(this, arguments);

                                if (_currentWrapFunc) {
                                    unwrapTimeout();
                                }
                                _currentWrapFunc = null;
                            } catch (e) {
                                if (_currentWrapFunc) {
                                    unwrapTimeout();
                                }
                                _currentWrapFunc = null;
                            }

                            //
                            if (_this.readyState == 4) {
                                tempCbTime = now() - endTime;
                            }
                            _createXhrData();
                        };
                    }

                    //
                    if (!this._wrap) {
                        this._openWrap.start = now();
                        this._openWrap.requestLength = arguments[0]
                            ? getResourceLength(arguments[0])
                            : 0;

                        var result = wrap(
                            false,
                            this,
                            'onreadystatechange',
                            _wrapReadyStateChange
                        );

                        if (!result) {
                            //addEventListener(this, 'readystatechange', _createXhrData);

                            setTimeout(function () {
                                wrap(false, _this, 'onreadystatechange', _wrapReadyStateChange);
                            }, 0);
                        }

                        addEventListener(this, 'error', function () {
                            if (_this._openWrap) {
                                _createXhrData('error');
                            }
                        });

                        //
                        addEventListener(this, 'abort', function () {
                            if (_this._openWrap) {
                                _createXhrData('abort');
                            }
                        });

                        addEventListener(this, 'loadstart', function () {
                            if (_this._openWrap) {
                                _this._openWrap.start = now();
                            }
                        });

                        addEventListener(this, 'timeout', function () {
                            if (_this._openWrap) {
                                _createXhrData('timeout');
                            }
                        });
                    }

                    try {
                        return event.apply(this, arguments);
                    } catch (e) {
                        return Function.prototype.apply.call(event, this, arguments);
                    }
                };
            });
        }
    }

    //
    function _addEvents() {
        // 不污染之前绑定的 onerror 事件
        function _listenIEError() {
            var preErrorFunc = window.onerror;
            window.onerror = function () {
                _handleWindowError.apply(this, arguments);
                if (isFunction(preErrorFunc)) {
                    preErrorFunc.apply(this, arguments);
                }
            };

            window.onerror._sn = true;
        }

        // 整个页面加载完成后上传
        addEventListener(window, 'load', function () {
            _handlePageLoad();

            //
            if (_fuckIe) {
                window.setTimeout(function () {
                    if (window.onerror && !window.onerror._sn) {
                        _listenIEError();
                    }
                }, 0);
            }
        });

        // 离开页面时上传
        addEventListener(window, 'beforeunload', function () {
            _handlePageLeave();
        });
        //
        addEventListener(window, 'pagehide', function () {
            _handlePageLeave();
        });
        //
        addEventListener(window, 'unload', function () {
            _handlePageLeave();
        });

        if (_fuckIe) {
            _listenIEError();
        } else {
            // 监听全局的 error 事件
            if (window.addEventListener) {
                addEventListener(window, 'error', _handleWindowError);
            }
        }
        //
        addEventListener(document, 'scroll', function () {
            setFirstTouchTime();
        });
        //
        addEventListener(document, 'keypress', function () {
            setFirstTouchTime();
        });
        //
        addEventListener(document, 'click', function () {
            setFirstTouchTime();
        });

        //
        addEventListener(document, 'DOMContentLoaded', function () {
            _initDomLoad();
        });
        //
        addEventListener(document, 'readystatechange', function () {
            if (document.readyState === 'complete') {
                _initDomLoad();
            }
        });
        // bind methods
        if (performance) {
            //
            addEventListener(performance, 'resourcetimingbufferfull', function () {
                if (performance.getEntriesByType) {
                    var resource = performance.getEntriesByType('resource');
                    if (resource) {
                        _performanceResourceTimingBufferList = _performanceResourceTimingBufferList.concat(
                            resource
                        );
                    }

                    performance.clearResourceTimings();
                }
            });

            //
            addEventListener(
                performance,
                'webkitresourcetimingbufferfull',
                function () {
                    if (performance.getEntriesByType) {
                        var resource = performance.getEntriesByType('resource');
                        if (resource) {
                            _performanceResourceTimingBufferList = _performanceResourceTimingBufferList.concat(
                                resource
                            );
                        }
                        performance.webkitClearResourceTimings();
                    }
                }
            );
        }
    }

    function _init() {
        _initBrowserInfo(); // 收集浏览器信息 存储在 storage 里面
        _initUserInfo(); // 初始化用户信息
        _wrapXMLHttpRequest(); // wrap XML Http request
        _addEvents(); // 添加绑定事件
    }

    /**
     *  可配置的阈值
     *
     * 慢页面阈值：slowT
     * 资源慢加载阈值：resourceT
     * Ajax慢请求阈值：slowAjaxT
     *
     * 对于采样比例  都是 传递过来的 xx  如果 100% 就传递 100 。
     * 正常采样比例：50%
     * 慢页面采样率：100%
     * 资源慢加载采样率：100%
     * 正常Ajax采样率：50%
     * 慢Ajax采样率：100%
     * JS错误采样率：100%
     * Ajax错误采样率：100%
     *
     */

    var defaultConfig = {
        version: _version,
        url: '', //
        err_url: '', //
        slowPageT: 7000,
        slowResourceT: 4000,
        slowAjaxT: 5000,

        normalP: 50,
        slowP: 100,
        slowResourceP: 100,
        ajaxP: 50,
        slowAjaxP: 100,
        jsErrorP: 100,
        ajaxErrorP: 100,
    };

    _init();

})(window, window.document);
