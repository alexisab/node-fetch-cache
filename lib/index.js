"use strict";

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var axios = require('axios');

var httpAdapter = require('axios/lib/adapters/http');

var hash = require('object-hash');

var NodeCache = require('node-cache');

function createFetcher(config) {
  var logger = config.logger || function () {
    return true;
  };

  var withCache = config.withCache,
      cacheMethods = config.cacheMethods;
  var cache = null;

  if (withCache) {
    cache = new NodeCache(config.cacheConfig);
  } // Helper functions


  var getRequestInfo = function getRequestInfo(config) {
    return {
      url: config.url,
      params: config.params || {}
    };
  };

  var getRequestHash = function getRequestHash(config) {
    return hash(getRequestInfo(config));
  }; // This custom adapter check cache before executing the request.
  // If the response for this request is cached, it returns the cached value
  // If the response is not cached, it executes the request


  var cacheAdapter = function cacheAdapter(config) {
    var requestHash = getRequestHash(config);

    if (withCache && cacheMethods.includes(config.method.toUpperCase()) && cache.keys().includes(requestHash)) {
      // NOTE The value may have been removed between the above call
      var cachedResp = cache.get(requestHash);

      if (!cachedResp) {
        logger(_objectSpread({}, getRequestInfo(config), {
          requestHash: requestHash,
          fromCache: false,
          cacheExpired: true
        }));
        return httpAdapter(config);
      }

      logger(_objectSpread({}, getRequestInfo(config), {
        requestHash: requestHash,
        fromCache: true
      }));
      return Promise.resolve(cache.get(requestHash));
    }

    logger(_objectSpread({}, getRequestInfo(config), {
      requestHash: requestHash,
      fromCache: false,
      cacheExpired: false
    }));
    return httpAdapter(config);
  }; // Create a custom axios instance


  var fetch = axios.create(_objectSpread({}, config, {
    // If cache is disabled we directly use the original axios http adapter
    adapter: withCache ? cacheAdapter : httpAdapter
  })); // This interceptor catch responses to check if the response must be cache or not

  fetch.interceptors.response.use(function (resp) {
    var requestHash = getRequestHash(resp.config);

    if (withCache && cacheMethods.includes(resp.config.method.toUpperCase()) && !cache.keys().includes(requestHash) && resp.status >= 200 && resp.status < 300) {
      logger(_objectSpread({
        action: 'cache:set'
      }, getRequestInfo(resp.config), {
        data: resp.data
      }));

      var request = resp.request,
          toCache = _objectWithoutProperties(resp, ["request"]);

      cache.set(requestHash, toCache);
    }

    return resp;
  });
  return fetch;
}

module.exports = createFetcher;