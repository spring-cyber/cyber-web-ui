import isWindows from '../_utils/is-windows.js';

/**
 * @function 解析路径
 * @param {String} path 
 * @returns {String}
 */
export function analysisPath(path) {
  if(!isWindows() || !path) return;
  if(/^http/.test(path)) return path;
  if(window.location.hash) {
    path = path.replace(/^#?\/?/, '');
    path = `#/${path}`
  }
  return path;
}

/**
 * @function 跳转网页
 * @param {String} href
 */
export function changeLocation(href) {
  if(!isWindows()) return;
  window.location.href = analysisPath(href);
} 

/**
 * @function 更改路由参数不刷新页面
 * @param {Object} query 路由参数
 * @param {Boolean} cover 是否覆盖原有参数
 * @param {Boolean} replace 是否调用replaceState方法
 */
export function changeHistoryState(query = {}, cover = false, replace = true) {
  if(!isWindows()) return;
  let key = 'pushState';
  if(replace) key = 'replaceState';
  let { url, params } = analysisHistory(window.location.href);
  let flag = true;
  let obj = {
    ...query
  };
  // 遍历参数
  Object.keys(obj).forEach(key => {
    // 判断是否为数组，并做处理
    if(Array.isArray(obj[key])) {
      obj[key] = obj[key].join(',');
      if(obj[key] != params[key]) {
        flag = false;
      }
      if(!obj[key]) {
        delete params[key]
        delete obj[key]
      }
    } else if(params[key] != obj[key]) {
      flag = false;
      // 若传入的参数有为空值，则删除路由对应参数
      if(!obj[key]) {
        delete params[key]
        delete obj[key]
      }
    }
  })
  // 重置页数
  if(!obj.pageNo && params.pageNo) {
    params.pageNo = 1;
  }
  // 若为不覆盖，并且参数全相等，则不跳转到新路由
  if(!cover && flag) return;
  url = url + jsonToSearch({
    ...(cover ? {} : params),
    ...obj,
  });
  // 统计返回层数
  let count = history.state?.go || -1;
  if(!replace) --count;
  window.history[key]({
    ...(history.state || {}),
    go: count,
    current: url.replace(/^#/, ''),
    position: (history.state?.position || 1) + 1,
    previousPosition: history.state?.previousPosition ? history.state.previousPosition : ((history.state?.position || 1) - 1 || 1),
  }, null, url);
}

/**
 * @function 将对象转成路由search参数
 * @param {Object} obj 
 * @returns {String}
 */
export function jsonToSearch(obj) {
  let query = [];
  Object.keys(obj).forEach(key => {
    if(obj[key] || obj[key] == '0') query.push(`${key}=${obj[key]}`);
  });
  query = query.join('&');
  return (query ? '?' + query : '').replace(/\+/g, '%2B'); // 编码 + 号为 %2B
}

/**
 * @function 将路由search参数转成对象
 * @param {String} str 
 * @returns {Object}
 */
export function searchToJson(str) {
  let query = {};
  (str || '')
    .replace(/^.*\?/, '')
    .replace(/%20|\+/g, ' ') // 解码为空格
    .split('&')
    .forEach(item => {
      let [key, value] = (item || '').split('=');
      if(key) query[key] = value;
    });
  return query;
}

/**
 * @function 返回上一个历史记录或指定路径
 * @param {String} url 指定路径
 */
export function historyBack(url) {
  if(!isWindows()) return;
  let { back, current, forward, go, previousPosition, position } = history.state || {};
  if(back && back != current) url = back;
  /* 
    1、有history.state.back
    2、当前go次数少于50
    3、history.state.back 不等于当前路径
    4、当前页面的position与上一个页面的position相差少于49
    5、当前的history.length要大于go次数
   */
  if(back && (go && go > -50) && back != current && (position - (previousPosition || 1) <= 49) && history.length >= Math.abs(go)) {
    let count = go || -1;
    window.history.go(count);
  } else if (!go && history.length != 1 && position != 1 && back != current) {
    history.back();
  } else {
    if(new URL(window.location.href)?.hash) {
      url = /^#/.test(url) ? url : `#${url}`;
    } else {
      url = url.replace(/^#/, '');
    }
    window.location.href = url;
  }
}

/**
 * @function 解析指定历史，获取到解析后的数据
 * @param {String} url
 * @returns {Object}
 */
export function analysisHistory(url) {
  if(!isWindows()) return;
  const href = new URL(url || window.location.href);
  if(href.hash) {
    // hash路由
    // hash: '#/pods?type=1'
    return {
      url: href.hash.replace(/\?.*/, ''),
      params: searchToJson(href.hash),
    }
  } else {
    // history路由
    // search: '?page=2&pageSize=10'
    return {
      url: href.pathname,
      params: searchToJson(href.search),
    }
  }
}

/**
 * @function 初始化参数
 * @param {Object} obj 需要初始化的参数
 * @param {String | undefined} url 地址
 * @returns {Object}
 */
export function initHistoryState(obj, url) {
  if(!isWindows()) return;
  let { params } = analysisHistory(url || window.location.href);
  Object.keys(obj).forEach(key => {
    // 默认值为数组，对url的params值做转换
    if(Array.isArray(obj[key])) {
      obj[key] = params[key]
        ? params[key].split(',').map(item => item ? item : '')
        : obj[key];
    }
    // 自定义类型配置，对url的params值做转换
    else if(Object.prototype.toString.call(obj[key]) === '[object Object]') {
      const { type = 'string', defaultValue } = obj[key];
      if(type == 'number') {
        obj[key] = /^\-?((0|[1-9]\d*)\.)?\d*$/.test(params[key]) ? Number(params[key]) : defaultValue * 1;
      } else if(type == 'array') {
        obj[key] = params[key] ? params[key].split(',') : defaultValue;
      } else if(type == 'boolean') {
        obj[key] = params[key]
          ? params[key] == 'true' ? true : false
          : defaultValue;
      } else if(type == 'string') {
        obj[key] = (params[key] || defaultValue || '');
      } else {
        obj[key] = params[key] || defaultValue;
      }
    }
    // 其他类型
    else {
      let value = params[key] ||  obj[key];
      obj[key] = typeof value == 'string'
        ? decodeURIComponent(value)
        : value;
    }
  });
  return obj;
}

/**
 * @function 改造方法
 * @param {String} type 方法类型 
 * @returns 
 */
export function _historyWrap(type) {
  const orig = history[type];
  const e = new Event(type);
  return function() {
    const rv = orig.apply(this, arguments);
    e.arguments = arguments;
    window.dispatchEvent(e);
    return rv;
  };
};

export function initialHistory() {
  if(isWindows()) {
    window.history.pushState = _historyWrap('pushState');
    history.replaceState = _historyWrap('replaceState');
  }
}