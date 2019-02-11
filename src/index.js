const axios = require('axios')
const httpAdapter = require('axios/lib/adapters/http')
const hash = require('object-hash')
const NodeCache = require('node-cache')

function createFetcher(config) {
    const logger = config.logger || (() => true)
    const { withCache, cacheMethods } = config

    let cache = null
    if (withCache) {
        cache = new NodeCache(config.cacheConfig)
    }

    // Helper functions
    const getRequestInfo = config => ({
        url: config.url,
        params: config.params || {},
    })

    const getRequestHash = config => hash(getRequestInfo(config))

    // This custom adapter check cache before executing the request.
    // If the response for this request is cached, it returns the cached value
    // If the response is not cached, it executes the request
    const cacheAdapter = config => {
        const requestHash = getRequestHash(config)

        if (withCache && cacheMethods.includes(config.method.toUpperCase()) && cache.keys().includes(requestHash)) {
            // NOTE The value may have been removed between the above call
            const cachedResp = cache.get(requestHash)

            if (!cachedResp) {
                logger.info({
                    ...getRequestInfo(config),
                    requestHash,
                    fromCache: false,
                    cacheExpired: true,
                })

                return httpAdapter(config)
            }

            logger.info({
                ...getRequestInfo(config),
                requestHash,
                fromCache: true,
            })
            return Promise.resolve(cache.get(requestHash))
        }

        logger.info({
            ...getRequestInfo(config),
            requestHash,
            fromCache: false,
            cacheExpired: false,
        })
        return httpAdapter(config)
    }

    // Create a custom axios instance
    const fetch = axios.create({
        ...config,

        // If cache is disabled we directly use the original axios http adapter
        adapter: withCache ? cacheAdapter : httpAdapter,
    })

    // This interceptor catch responses to check if the response must be cache or not
    fetch.interceptors.response.use(resp => {
        const requestHash = getRequestHash(resp.config)

        if (
            withCache &&
            cacheMethods.includes(resp.config.method.toUpperCase()) &&
            !cache.keys().includes(requestHash) &&
            resp.status >= 200 &&
            resp.status < 300
        ) {
            logger.info({
                action: 'cache:set',
                ...getRequestInfo(resp.config),
                data: resp.data,
            })

            const { request, ...toCache } = resp
            cache.set(requestHash, toCache)
        }

        return resp
    })

    return fetch
}

module.exports = createFetcher
