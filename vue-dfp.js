/* eslint-disable */
;(() => {

  'use strict'

  let installed = false

  let dfpScript = window || {}
  let adsCouldNeverBeInitilized = false
  let dfpIsLoaded = false
  let checkInitializeNoShowTimer

  let xhr
  if (typeof XMLHttpRequest !== 'undefined') {
    xhr = new XMLHttpRequest()
  } else {
    [
      'MSXML2.XmlHttp.5.0',
      'MSXML2.XmlHttp.4.0',
      'MSXML2.XmlHttp.3.0',
      'MSXML2.XmlHttp.2.0',
      'Microsoft.XmlHttp'
    ].every((version) => {
      try {
        xhr = new ActiveXObject(version)
        return false
      } catch (e) {}
    })
  }

  const util = {
    getUrlTargeting (url) {
      // Get the url and parse it to its component parts using regex from RFC2396 Appendix-B (https://tools.ietf.org/html/rfc2396#appendix-B)
      const urlMatches = (url || window.location.toString()).match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/)
      const matchedAuthority = urlMatches[4] || ''
      const matchedPath = (urlMatches[5] || '').replace(/(.)\/$/, '$1')
      const matchedQuery = urlMatches[7] || ''

      // Get the query params for targeting against
      const params = matchedQuery.replace(/\=/ig, ':').split('&')

      return {
        Host: matchedAuthority,
        Path: matchedPath,
        Query: params
      }
    },
    dfpBlocked () {
      let googletag = window.googletag
      // Get the stored dfp commands
      let commands = googletag.cmd

      let _defineSlot = function (name, dimensions, id, oop) {
        googletag.ads.push(id)
        googletag.ads[id] = {
          renderEnded: function () { },
          addService: function () { return this }
        }
        return googletag.ads[id]
      }

      // overwrite the dfp object - replacing the command array with a function and defining missing functions
      googletag = {
        cmd: {
          push: function (callback) {
            callback.call(dfpScript)
          }
        },
        ads: [],
        pubads: function () { return this },
        noFetch: function () { return this },
        disableInitialLoad: function () { return this },
        disablePublisherConsole: function () { return this },
        enableSingleRequest: function () { return this },
        setTargeting: function () { return this },
        collapseEmptyDivs: function () { return this },
        enableServices: function () { return this },
        defineSlot: function (name, dimensions, id) {
          return _defineSlot(name, dimensions, id, false)
        },
        defineOutOfPageSlot: function (name, id) {
          return _defineSlot(name, [], id, true)
        },
        display: function (id) {
          googletag.ads[id].renderEnded.call(dfpScript)
          return this
        }
      }
      // Execute any stored commands
      commands.forEach((v) => {
        googletag.cmd.push(v)
      })
    },
    dfpLoader () {
      return new Promise((resolve) => {
        dfpIsLoaded = dfpIsLoaded || document.querySelectorAll('script[src*="googletagservices.com/tag/js/gpt.js"]').length
        if (dfpIsLoaded) {
          return Promise.resolve()
        }

        window.googletag = window.googletag || {}
        window.googletag.cmd = window.googletag.cmd || []

        let gads = document.createElement('script')
        gads.async = true
        gads.type = 'text/javascript'

        // Adblock blocks the load of Ad scripts... so we check for that
        gads.onerror = () => {
          this.dfpBlocked()
          adsCouldNeverBeInitilized = true
          resolve()
        }

        gads.onload = function() {
          // this will work with ghostery:
          if (!googletag._loadStarted_) {
            googletag._adBlocked_ = true
          }
          dfpIsLoaded = true
          resolve()
        }

        let useSSL = 'https:' === document.location.protocol
        gads.src = (useSSL ? 'https:' : 'http:') +
        '//www.googletagservices.com/tag/js/gpt.js'
        let node = document.getElementsByTagName('script')[0]
        node.parentNode.insertBefore(gads, node)
      })
    }
  }

  const VueDfp = (Vue, options) => {
    Vue.component('vue-dfp', Vue.extend({
      template: '<div class="vue-dfp-adunit"><div v-bind:id="adUnitID"></div></div>',
      props: {
        adunit: {
          type: String,
          required: true
        },
        dimensions: {
          type: String
        },
        targeting: {
          type: Object,
          default () {
            return {}
          }
        },
        companion: {
          type: Boolean,
          default: false
        },
        outofpage: {
          type: Boolean,
          default: false
        },
        exclusions: {
          type: Array,
          default () {
            return []
          }
        },
        sizeMapping: {
          type: String,
          default: ''
        }
      },
      ready () {
        this.getDimensions()

        let googletag = window.googletag

        googletag.cmd.push(() => {
          const dfpOptions = Vue.config.dfpOptions
          let googleAdUnit
          let slotName

          if (typeof this.sotreAs !== 'undefined') {
            googleAdUnit = this.sotreAs
          } else {
            if (dfpOptions.dfpID === '') {
              slotName = this.adunit
            } else {
              slotName = '/' + dfpOptions.dfpID + '/' + this.adunit
            }
          }

          if (this.outofpage) {
            googleAdUnit = googletag.defineOutOfPageSlot(slotName, this.adUnitID)
          } else {
            googleAdUnit = googletag.defineSlot(slotName, this.dimensions, this.adUnitID)
            if (this.companion) {
              googleAdUnit = googleAdUnit.addService(googletag.companionAds())
            }
            googleAdUnit = googleAdUnit.addService(googletag.pubads())
          }

          if (Object.keys(this.targeting).length > 0) {
            for (let x in this.targeting) {
              googleAdUnit.setTargeting(x, this.targeting[x])
            }
          }

          if (this.exclusions.length > 0) {
            exclusions.forEach((exclusion) => {
              googleAdUnit.setCategoryExclusion(exclusion)
            })
          }

          if (this.sizeMapping !== '' && Object.keys(dfpOptions.sizeMapping).length > 0) {
            let map = googletag.sizeMapping();
            if (typeof dfpOptions.sizeMapping[this.sizeMapping] !== 'undefined') {
              dfpOptions.sizeMapping[this.sizeMapping].forEach((mapping) => {
                map.addSize(mapping.browser, mapping.ad_sizes)
              })
            }
            googleAdUnit.defineSizeMapping(map.build())
          }

          let storeAs = {}
          storeAs[this.adUnitID] = googleAdUnit
          dfpOptions.adUnits.push(storeAs)

          if (typeof dfpOptions.beforeEachAdLoaded === 'function') {
            dfpOptions.beforeEachAdLoaded.call(this, document.getElementById(this.adUnitID));
          }
        })
      },
      methods: {
        generateId () {
          return (((1 + Math.random()) * 0x10000)|0).toString(16).substring(1)
        },
        getDimensions () {
          let dimensions = []
          if (typeof this.dimensions !== 'undefined' && this.dimensions !== '') {
            this.dimensions.split(',').forEach((v) => {
              const dimensionSet = v.split('x')
              dimensions.push([parseInt(dimensionSet[0], 10), parseInt(dimensionSet[1], 10)])
            })
          } else {
            dimensions.push([this.$el.offsetWidth, this.$el.offsetHeight])
          }
          this.dimensions = dimensions
        }
      },
      data () {
        return {
          adUnitID: this.adunit.replace(/[^A-z0-9]/g, '_') + '-auto-gen-id-' + this.generateId() + this.generateId()
        }
      }
    }))

    let dfpOptions = Object.assign({
      dfpID: '',
      setTargeting: {},
      setCategoryExclusion: '',
      setLocation: '',
      enableSingleRequest: true,
      collapseEmptyDivs: 'original',
      refreshExisting: true,
      disablePublisherConsole: false,
      disableInitialLoad: false,
      setCentering: false,
      noFetch: false,
      namespace: undefined,
      sizeMapping: [],
      afterAdBlocked: undefined,
      afterEachAdLoaded: undefined,
      afterAllAdsLoaded: undefined
    }, options, {
      rendered: 0,
      onloaded: [],
      adUnits: []
    })

    if (typeof options.setUrlTargeting === 'undefined' || options.setUrlTargeting) {
      var urlTargeting = util.getUrlTargeting(options.url);
      dfpOptions.setTargeting = Object.assign({}, options.setTargeting, {
        UrlHost: urlTargeting.Host,
        UrlPath: urlTargeting.Path,
        UrlQuery: urlTargeting.Query
      });
    }

    Object.defineProperty(Vue.config, 'dfpOptions', Object.assign({}, dfpOptions, {
      enumerable: true,
      configurable: true,
      get: () => { return dfpOptions },
      set: val => { dfpOptions = val }
    }))

    const loadGoogleTag = () => {
      document.removeEventListener('DOMContentLoaded', loadGoogleTag, false)

      const slots = document.querySelectorAll('.vue-dfp-adunit')

      googletag.cmd.push(() => {
        let pubadsService = googletag.pubads()

        if (dfpOptions.enableSingleRequest) {
            pubadsService.enableSingleRequest()
        }

        for (let x in dfpOptions.setTargeting) {
          pubadsService.setTargeting(x, dfpOptions.setTargeting[x])
        }

        const setLocation = dfpOptions.setLocation
        if (typeof setLocation === 'object') {
          if (typeof setLocation.latitude === 'number' && typeof setLocation.longitude === 'number' &&
            typeof setLocation.precision === 'number') {
            pubadsService.setLocation(setLocation.latitude, setLocation.longitude, setLocation.precision);
          } else if (typeof setLocation.latitude === 'number' && typeof setLocation.longitude === 'number') {
            pubadsService.setLocation(setLocation.latitude, setLocation.longitude)
          }
        }

        if (dfpOptions.setCategoryExclusion.length > 0) {
          const exclusionsGroup = dfpOptions.setCategoryExclusion.split(',')
          let valueTrimmed

          exclusionsGroup.forEach((v) => {
            valueTrimmed = v.trim()
            if (valueTrimmed.length > 0) {
              pubadsService.setCategoryExclusion(valueTrimmed)
            }
          })
        }

        if (dfpOptions.collapseEmptyDivs) {
          pubadsService.collapseEmptyDivs()
        }

        if (dfpOptions.disablePublisherConsole) {
          pubadsService.disablePublisherConsole()
        }

        if (dfpOptions.companionAds) {
          googletag.companionAds().setRefreshUnfilledSlots(true)

          if (!dfpOptions.disableInitialLoad) {
            pubadsService.enableVideoAds()
          }
        }

        if (dfpOptions.disableInitialLoad) {
          pubadsService.disableInitialLoad()
        }

        if (dfpOptions.noFetch) {
          pubadsService.noFetch()
        }

        if (dfpOptions.setCentering) {
          pubadsService.setCentering(true)
        }

        pubadsService.addEventListener('slotOnload', function (event) {
          dfpOptions.onloaded.push(event.slot)
        })

        pubadsService.addEventListener('slotRenderEnded', function (event) {
          dfpOptions.rendered++

          if (typeof dfpOptions.afterEachAdLoaded === 'function') {
            const adunit = Array.prototype.find.call(slots, function (slot) {
              return event.slot.getSlotId().getDomId() === slot.firstElementChild.id
            })
            if (typeof adunit !== 'undefined') {
              dfpOptions.afterEachAdLoaded.call(
                this,
                document.getElementById(adunit.firstElementChild.id),
                event
              )
            }
          }

          setTimeout(() => {
            if (dfpOptions.rendered === dfpOptions.onloaded.length &&
              dfpOptions.onloaded.length !== dfpOptions.adUnits.length
            ) {
              const noShowDfp = dfpOptions.adUnits.filter((adunit) => {
                return !(dfpOptions.onloaded.find((slot) => {
                  return slot.getSlotId().getDomId() === Object.keys(adunit)[0]
                }))
              })

              if (noShowDfp.length > 0) {
                noShowDfp.forEach((adunit) => {
                  googletag.cmd.push(function () {
                    googletag.pubads().refresh([adunit[Object.keys(adunit)[0]]])
                  })
                })
              }
            }
          }, 500)

          if (dfpOptions.rendered === dfpOptions.adUnits.length &&
            typeof dfpOptions.afterAllAdsLoaded === 'function'
          ) {
            let getSlots = []
            Array.prototype.forEach.call(slots, (adunit) => {
              getSlots.push(document.getElementById(adunit.firstElementChild.id))
            })
            dfpOptions.afterAllAdsLoaded.call(this, getSlots, event);
          }
        })

        if (dfpScript.shouldCheckForAdBlockers() && !googletag._adBlocked_) {
          setTimeout(() => {
            let getSlots = pubadsService.getSlots ? pubadsService.getSlots() : [];
            if (getSlots.length > 0) {
              xhr.onload = (r) => {
                if (r.status !== 200) {
                  Array.prototype.forEach.call(getSlots, function (slot) {
                    dfpOptions.afterAdBlocked.call(
                      dfpScript,
                      document.getElementById(slot.getSlotId().getDomId()),
                      this
                    )
                  })
                }
              }
              xhr.open('get', getSlots[0].getContentUrl(), true)
              xhr.send()
            }
          }, 0);
        }

        googletag.enableServices()
      })

      if (dfpScript.shouldCheckForAdBlockers() && !googletag._adBlocked_) {
        if (googletag.getVersion) {
          const src = '//partner.googleadservices.com/gpt/pubads_impl_' +
            googletag.getVersion() + '.js';
          let script = document.createElement('<script>')
          script.type = 'text/javascript'
          script.src = '//partner.googleadservices.com/gpt/pubads_impl_' +
            googletag.getVersion() + '.js';
          script.onload = function (r) {
            if (r && r.statusText === 'error') {
              Array.prototype.forEach.call(slots, function (adunit) {
                dfpOptions.afterAdBlocked.call(
                  dfpScript,
                  document.getElementById(adunit.firstElementChild.id),
                  this
                );
              })
            }
          }

          document.querySelector('head').appendChild(script)
        }
      }

      Array.prototype.forEach.call(slots, function (adunit) {
        if (googletag._adBlocked_) {
          if (dfpScript.shouldCheckForAdBlockers()) {
            dfpOptions.afterAdBlocked.call(
              dfpScript,
              document.getElementById(adunit.firstElementChild.id),
              this
            )
          }
        }

        let adUnit = dfpOptions.adUnits.find((unit) => {
          return adunit.firstElementChild.id === Object.keys(unit)[0]
        })

        if (dfpOptions.refreshExisting &&
          typeof adUnit !== 'undefined'
        ) {
          googletag.cmd.push(function () {
            googletag.pubads().refresh([adUnit[adunit.firstElementChild.id]])
          })
        } else {
          googletag.cmd.push(function () {
            googletag.display(adunit.firstElementChild.id)
          })
        }
      })

      let noShowTimer = 3
      const checkInitializeNoShow = () => {
        if (typeof checkInitializeNoShowTimer !== 'undefined') {
          clearInterval(checkInitializeNoShowTimer)
        }

        checkInitializeNoShowTimer = setInterval(() => {
          if (noShowTimer > 0) {
            Array.prototype.forEach.call(slots, (adunit) => {
              if (adunit.firstElementChild.hasAttribute('data-google-query-id') === false) {
                let adUnit = dfpOptions.adUnits.find((unit) => {
                  return adunit.firstElementChild.id === Object.keys(unit)[0]
                })
                if (typeof adUnit !== 'undefined') {
                  googletag.cmd.push(function () {
                    googletag.pubads().refresh([adUnit[adunit.firstElementChild.id]])
                  })
                }
              }
            })
            noShowTimer--
          }
        }, 1000)
      }

      checkInitializeNoShow()
    }

    document.addEventListener('DOMContentLoaded', loadGoogleTag, false)

    if (installed ||
      typeof options === 'undefined' ||
      typeof options.dfpID === 'undefined'
    ) {
      return
    }

    if (typeof dfpOptions.googletag !== 'undefined') {
      window.googletag.cmd.push(function () {
        window.googletag = Object.assign({}, window.googletag, dfpOptions.googletag)
      });
    }

    dfpScript.shouldCheckForAdBlockers = () => {
      return dfpOptions ? typeof dfpOptions.afterAdBlocked === 'function' : false
    }

    util.dfpLoader().then(() => {
      installed = true
    })
  }

  if(typeof exports === 'object' && typeof module === 'object') {
    module.exports = VueDfp
  } else if(typeof define === 'function' && define.amd) {
    define(function () { return VueDfp })
  } else if (typeof window !== 'undefined') {
    window.VueDfp = VueDfp
  }
})()
