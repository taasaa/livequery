/*! Copyright (c) 2013 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt)
 */

(function (factory) {
    if ( typeof define === 'function' && define.amd ) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS style for Browserify
        module.exports = factory;
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    $.extend($.fn, {
        livequery: function(matchedFn, unmatchedFn) {
            var q = $.livequery.findorcreate(this, matchedFn, unmatchedFn);
            q.run();
            return this;
        },
        expire: function(matchedFn, unmatchedFn) {
            var q = $.livequery.find(this, matchedFn, unmatchedFn);
            if (q) { q.stop(); }
            return this;
        }
    });


    $.livequery = function(selector, context, matchedFn, unmatchedFn) {
        this.selector    = selector;
        this.context     = context;
        this.matchedFn   = matchedFn;
        this.unmatchedFn = unmatchedFn;
        this.stopped     = false;
        this.id          = $.livequery.queries.push(this)-1;

        matchedFn.$lqguid = matchedFn.$lqguid || $.livequery.guid++;
        if (unmatchedFn) unmatchedFn.$lqguid = unmatchedFn.$lqguid || $.livequery.guid++;
    };
    $.livequery.prototype = {
        run: function() {
            this.stopped = false;
            $(this.selector, this.context).each($.proxy(function(i, element) {
                this.added(element);
            }, this));
        },
        stop: function() {
            $(this.selector, this.context).each($.proxy(function(i, element) {
                this.removed(element);
            }, this));
            this.stopped = true;
        },
        matches_selector: function(element) {
            return $(element, this.context).is(this.selector);
        },
        matches_children: function(element) {
            return $(element, this.context).find(this.selector).length > 0;
        },
        matches: function(element) {
            return !this.isStopped() && (this.matches_selector(element) || this.matches_children(element));
        },
        actual_element: function(element) {
            if (this.matches_selector(element))
                return $(element, this.context);
            else if (this.matches_children(element))
                return $(element, this.context).find(this.selector);
            else
                return element;
        },
        added: function(element) {
            if ( !this.isStopped() && !this.isMatched(element) ) {
                this.markAsMatched(element);
                this.matchedFn.call(this.actual_element(element));
            }
        },
        removed: function(element) {
            if ( !this.isStopped() && this.isMatched(element) ) {
                this.removeMatchedMark(element);
                if (this.unmatchedFn) this.unmatchedFn.call(this.actual_element(element));
            }
        },
        getLQArray: function(element) {
            var arr   = $.data(element, $.livequery.key) || [],
                index = $.inArray(this.id, arr);
            arr.index = index;
            return arr;
        },
        markAsMatched: function(element) {
            var arr  = this.getLQArray(element);
            if ( arr.index === -1 ) {
                arr.push(this.id);
                $.data(element, $.livequery.key, arr);
            }
        },
        removeMatchedMark: function(element) {
            var arr = this.getLQArray(element);
            if ( arr.index > -1 ) {
                arr.splice(arr.index, 1);
                $.data(element, $.livequery.key, arr);
            }
        },
        isMatched: function(element) {
            var arr = this.getLQArray(element);
            return arr.index !== -1;
        },
        isStopped: function() {
            return this.stopped === true;
        }
    };

    $.extend($.livequery, {
        guid: 0,
        queries: [],
        watchAttributes: true,
        attributeFilter: ['class', 'className'],
        setup: false,
        timeout: null,
        method: 'none',
        prepared: false,
        key: 'livequery',
        htcPath: false,
        prepare: {
            mutationobserver: function() {
                var observer = new MutationObserver($.livequery.handle.mutationobserver);
                observer.observe(document, { childList: true, attributes: $.livequery.watchAttributes, subtree: true, attributeFilter: $.livequery.attributeFilter });
                $.livequery.prepared = true;
            },
            mutationevent: function() {
                document.addEventListener('DOMNodeInserted', $.livequery.handle.mutationevent, false);
                document.addEventListener('DOMNodeRemoved', $.livequery.handle.mutationevent, false);
                if ( $.livequery.watchAttributes ) {
                    document.addEventListener('DOMAttrModified', $.livequery.handle.mutationevent, false);
                }
                $.livequery.prepared = true;
            },
            iebehaviors: function() {
                if ( $.livequery.htcPath ) {
                    $('head').append('<style>body *{behavior:url('+$.livequery.htcPath+')}</style>');
                    $.livequery.prepared = true;
                }
            }
        },
        handle: {
            added: function(target) {
                $.each( $.livequery.queries, function(i, query) {
                    if (query.matches(target)) {
                        setTimeout(function() {
                            query.added(target);
                        }, 1);
                    }
                });
            },
            removed: function(target) {
                $.each( $.livequery.queries, function(i, query) {
                    if (query.isMatched(target)) {
                        setTimeout(function() {
                            query.removed(target);
                        }, 1);
                    }
                });
            },
            modified: function(target) {
                $.each( $.livequery.queries, function(i, query) {
                    if ( query.isMatched(target) ) {
                        if ( !query.matches(target) ) {
                            query.removed(target);
                        }
                    } else {
                        if (query.matches(target)) {
                            query.added(target);
                        }
                    }
                });
            },
            mutationevent: function(event) {
                var map = {
                        'DOMNodeInserted' : 'added',
                        'DOMNodeRemoved'  : 'removed',
                        'DOMAttrModified' : 'modified'
                    },
                    type = map[event.type];
                if ( type === 'modified' ) {
                    if ( $.livequery.attributeFilter.indexOf(event.attrName) > -1 ) {
                        $.livequery.handle.modified(event.target);
                    }
                } else {
                    $.livequery.handle[type](event.target);
                }
            },
            mutationobserver: function(mutations) {
                $.each(mutations, function(index, mutation) {
                    if (mutation.type === 'attributes') {
                        $.livequery.handle.modified(mutation.target);
                    } else {
                        $.each(['added', 'removed'], function(i, type) {
                            $.each(mutation[type + 'Nodes'], function(i, element) {
                                $.livequery.handle[type](element);
                            });
                        });
                    }
                });
            }
        },
        find: function(jq, matchedFn, unmatchedFn) {
            var q;
            $.each( $.livequery.queries, function(i, query) {
                if ( jq.selector == query.selector && jq.context == query.context &&
                    (!matchedFn || matchedFn.$lqguid == query.matchedFn.$lqguid) &&
                    (!unmatchedFn || unmatchedFn.$lqguid == query.unmatchedFn.$lqguid) )
                        return (q = query) && false;
            });
            return q;
        },
        findorcreate: function(jq, matchedFn, unmatchedFn) {
            return $.livequery.find(jq, matchedFn, unmatchedFn) ||
                new $.livequery(jq.selector, jq.context, matchedFn, unmatchedFn);
        }
    });

    $(function() {
        if ('MutationObserver' in window) {
            $.livequery.method = 'mutationobserver';
        } else if ('MutationEvent' in window) {
            $.livequery.method = 'mutationevent';
        } else if ('behavior' in document.documentElement.currentStyle) {
            $.livequery.method = 'iebehaviors';
        }

        if ($.livequery.method) {
            $.livequery.prepare[$.livequery.method]();
        } else {
            throw new Error('Could not find a means to monitor the DOM');
        }
    });

}));
