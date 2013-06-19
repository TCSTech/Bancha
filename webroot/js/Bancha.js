/*!
 *
 * Bancha Project : Seamlessly integrates CakePHP with ExtJS and Sencha Touch (http://banchaproject.org)
 * Copyright 2011-2013 StudioQ OG
 *
 * @package       Bancha
 * @copyright     Copyright 2011-2013 StudioQ OG
 * @link          http://banchaproject.org Bancha Project
 * @since         Bancha v 0.0.2
 * @author        Roland Schuetz <mail@rolandschuetz.at>
 * @version       Bancha v PRECOMPILER_ADD_RELEASE_VERSION
 *
 * For more information go to http://banchaproject.org
 */
/*jslint browser: true, vars: false, plusplus: true, white: true, sloppy: true */
/*jshint bitwise:true, curly:true, eqeqeq:true, forin:true, immed:true, latedef:true, newcap:true, noarg:true, noempty:true, regexp:true, undef:true, trailing:false, strict:false */
/*global Ext:false, Bancha:true, TraceKit:false */

/**
 * @class Bancha.data.Model
 * @extends Ext.data.Model
 * 
 * 
 * This should only be used by Bancha internally, 
 * since it just has an additional flag to force consistency in Bancha.
 * 
 * 
 * @author Roland Schuetz <mail@rolandschuetz.at>
 * @docauthor Roland Schuetz <mail@rolandschuetz.at>
 */
Ext.define('Bancha.data.Model', {
    extend: 'Ext.data.Model',
    /**
     * @cfg
     * If true the frontend forces consistency
     * This is not yet supported! See http://docs.banchaproject.org/resources/Roadmap.html
     */
    forceConsistency: false
});


/**
 * @private
 * This should only be used by Bancha internally.
 * 
 * For Sencha Touch it fixes a bug inside writeDate.
 * 
 * For ExtJS 4.1.1a+ it adds support date fields with  
 * value null.
 * 
 * For ExtJS 4.1.0 and below it adds support for date 
 * conversions.
 *
 * @author Roland Schuetz <mail@rolandschuetz.at>
 * @docauthor Roland Schuetz <mail@rolandschuetz.at>
 */
Ext.define('Bancha.data.writer.JsonWithDateTime', {
    extend: 'Ext.data.writer.Json',
    alias: 'writer.jsondate',
    
    /**
     * Add support for null dates to ExtJS
     */
    getRecordData: function(record, operation) {
        // let the json writer do the real work
        var data = this.superclass.getRecordData.apply(this,arguments),
            nameProperty = this.nameProperty, 
            fields = record.fields,
            fieldItems = fields.items,
            me = this;

        // Sencha Touch is augmented in the writeDate fucntion, so we are done here
        // ExtJS doesn't have a writeDate function yet, so we need to augment below
        if(Ext.versions.touch) {
            return data;
        }

        // for ExtJS 4.1.1+ versions add support for null
        if(parseInt(Ext.versions.extjs.shortVersion,10) >= 411) {
            Ext.each(fieldItems, function(field) {
                var name = field[nameProperty] || field.name; 
                if (field.type === Ext.data.Types.DATE && field.dateFormat && record.get(field.name)===null) {
                    data[name] = null;
                }
            });

        // for older ExtJS versions add full date conversion support
        } else {
            Ext.each(fieldItems, function(field) {
                var name = field[nameProperty] || field.name; 
                if (field.type === Ext.data.Types.DATE && field.dateFormat) {
                    data[name] = me.writeDate(field, record.get(field.name));
                }
            });
        }

        return data;
    },

    /**
     * Fix Sencha Touch 2.1.1 and below to use the 
     * dateFormat and add support for null dates.
     *
     * Since ExtJS doesn't have a function called 
     * writeDate but is also buggy prior to Ext 4.1.1
     * we call this function from getRecordData
     *
     * Bug Report:
     * http://www.sencha.com/forum/showthread.php?249288-Ext.data.writer.Json-doesn-t-use-dateFormat
     */
    writeDate: function(field, date) {
        var dateFormat = field.dateFormat || (field.getDateFormat ? field.getDateFormat() : false) || 'timestamp'; // <-- fixed this line
        switch (dateFormat) {
            case 'timestamp':
                return date.getTime()/1000;
            case 'time':
                return date.getTime();
            default:
                if(date===null || !Ext.isDefined(date)) { // <-- added support for null and undefined
                    return date;
                }
                return Ext.Date.format(date, dateFormat);
        }
    }
});

/**
 * @private
 * This should only be used by Bancha internally, 
 * it adds the consistent uid to all requests.
 * @author Roland Schuetz <mail@rolandschuetz.at>
 * @docauthor Roland Schuetz <mail@rolandschuetz.at>
 */
Ext.define('Bancha.data.writer.ConsistentJson', {
    extend: 'Bancha.data.writer.JsonWithDateTime',
    alias: 'writer.consistent',
    
    /**
     * @config
     * the name of the field to send the consistent uid in
     */
    uidProperty: '__bcid',
    
    /**
     * @config {Bancha.data.Model} model
     * the model to write for, needed to determine the value of 
     * {@link Bancha.data.Model#forceConsistency model.forceConsistency}
     */
    model: undefined,
    //inherit docs
    writeRecords: function(request, data) {
        
        // IFDEBUG
        if(!this.model) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Bancha.data.writer.ConsistentJson needs a reference to the model.'
            });
        }
        // ENDIF
        
        // set consistent uid if expected
        if(this.model && this.model.forceConsistency) {
            if (this.encode) {
                request.params[this.uidProperty] = Bancha.getConsistentUid();
            } else {
                // send as jsonData
                request.jsonData[this.uidProperty] = Bancha.getConsistentUid();
            }
        }
        
        // let the json writer do all the work:
        return this.superclass.writeRecords.apply(this,arguments);
    }
});


/**
 * @private
 * @class Bancha.data.override.Validations
 * 
 * Add custom validators to {@class Ext.data.validations}.  
 * 
 * @author Roland Schuetz <mail@rolandschuetz.at>
 * @docauthor Roland Schuetz <mail@rolandschuetz.at>
 */
Ext.define('Bancha.data.override.Validations', {
    requires: ['Ext.data.validations']
}, function() {

    // helper function for Bancha.data.override.validations
    var filenameHasExtension = function(filename,validExtensions) {
        if(!filename) {
            return true; // no file defined (emtpy string or undefined)
        }
        if(!Ext.isDefined(validExtensions)) {
            return true;
        }
        var ext = filename.split('.').pop();
        return Ext.Array.contains(validExtensions,ext);
    };
    
    /**
     * @class Ext.data.validations
     * 
     * Bancha extends Ext.data.validations with two new validation rules: 
     * numberformat and file.  
     * 
     * These custom validations are mapped from CakePHP.
     * 
     * @author Roland Schuetz <mail@rolandschuetz.at>
     * @docauthor Roland Schuetz <mail@rolandschuetz.at>
     */
    Ext.apply(Ext.data.validations, { // this is differently called in ExtJS and Sencha Touch, but work by alias just fine
        /**
         * @property
         * The default error message used when a numberformat validation fails.
         */
        numberformatMessage: "is not a number or not in the allowed range",
        /**
         * @property
         * The default error message used when a file validation fails.
         */
        fileMessage: "is not a valid file",
        /**
         * @method
         * Validates that the number is in the range of min and max.
         * Precision is not validated, but it is used for differenting int from float,
         * also it's metadata for scaffolding.
         * For example:
         *     {type: 'numberformat', field: 'euro', precision:2, min:0, max: 1000}
         */
        numberformat: function(config, value) {
            if(typeof value !== 'number') {
                value = (config.precision===0) ? parseInt(value,10) : parseFloat(value);
                if(typeof value !== 'number') {
                    return false; // could not be converted to a number
                }
            }
            if((Ext.isDefined(config.min) && config.min > value) || (Ext.isDefined(config.max) && value > config.max)) {
                return false; // not in the range
            }
            return true;
        },
        /**
         * @method
         * Validates that the given filename is of the configured extension. Also validates
         * if no extension are defined and empty values.
         * For example:
         *     {type: 'file', field: 'avatar', extension:['jpg','jpeg','gif','png']}
         */
        file: function(config, value) {
            return filenameHasExtension(value,config.extension);
        }
    }); //eo apply
}); //eo override


/*
 * Polyfill for IE 6,7 and partially 8
 * Add support for ECMAScript 5 Array.reduce
 * Currently used in Ext.objectFromPath
 * From https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/Reduce
 */
 /*jsl:ignore*/
/*jshint bitwise:false, curly:false */
if (!Array.prototype.reduce) {
  Array.prototype.reduce = function reduce(accumulator){
    if (this===null || this===undefined) throw new TypeError("Object is null or undefined");
    var i = 0, l = this.length >> 0, curr;

    if(typeof accumulator !== "function") // ES5 : "If IsCallable(callbackfn) is false, throw a TypeError exception."
      throw new TypeError("First argument is not callable");

    if(arguments.length < 2) {
      if (l === 0) throw new TypeError("Array length is 0 and no second argument");
      curr = this[0];
      i = 1; // start accumulating at the second element
    }
    else
      curr = arguments[1];

    while (i < l) {
      if(i in this) curr = accumulator.call(undefined, curr, this[i], i, this);
      ++i;
    }

    return curr;
  };
}
/*jshint bitwise:true, curly:true */
/*jsl:end*/

/**
 * @class Bancha
 * 
 * This singleton is the core of Bancha on the client-side.  
 * For documentation on how to use it please look at the docs at banchaproject.org  
 * 
 * example usage:
 *     <!-- include Bancha and the remote API -->
 *     <script type="text/javascript" src="/Bancha/js/Bancha-dev.js"></script>
 *     <script type="text/javascript" src="/bancha-api/models/all.js"></script>
 *     <script>
 *         // when Bancha is ready, the model meta data is loaded
 *         // from the server and the model is created....
 *         Bancha.onModelReady('User', function(userModel) {
 *             
 *             ... your code ...
 *             
 *         }); //eo onModelReady
 *     </script>
 *   
 * If you want to listen for exceptions, please do this directly on Ext.direct.Manager
 *
 * @singleton
 * @author Roland Schuetz <mail@rolandschuetz.at>
 * @docauthor Roland Schuetz <mail@rolandschuetz.at>
 */
Ext.define('Bancha', {
    
    /* Begin Definitions */
    singleton: true,
    
    requires: [
        'Ext.data.*',
        'Ext.direct.*',
        'Ext.MessageBox',
        'Bancha.data.override.Validations'
    ],

    alternateClassName: [
        'Bancha.Main' // If you want to include Bancha using the Microloader use this class name instead of simply 'Bancha'
    ],
    /* End Definitions */
    
    
    // IFDEBUG
    /**
     * @private
     * @property
     * This property only exists in the debug version to indicate 
     * to jasmine tests that this is a debug version
     */
    debugVersion: true, 
    // ENDIF

    /**
     * @private
     * @export
     * The internal reference to the Remote API.  
     *
     * Export annotation is for Google Closure compiler.  
     *
     * Default: If the remote api is already loaded, keep it.
     * Otherwise set to undefined.
     * */
    REMOTE_API: (typeof Bancha !== 'undefined') ? Bancha.REMOTE_API : undefined,
    
    /**
     * @property
     * Bancha Project version
     */
    version: 'PRECOMPILER_ADD_RELEASE_VERSION',
    /**
     * @property
     * The local path to the Bancha remote api (Default: 'Bancha.REMOTE_API')  
     * Only change this if you changed 'Bancha.remote_api' in the CakePHP config, never change after {@link Bancha#init}
     */
    remoteApi: 'Bancha.REMOTE_API',
    /**
     * @private
     * @property
     * This function should normally not be changed, it corresponds to the serverside BanchaController method.
     * The path of the RCP for loading model meta data from the server, without the namespace. (Default: 'Bancha.loadMetaData')
     */
    metaDataLoadFunction: 'Bancha.loadMetaData',
    /**
     * @private
     * @property
     * The name of uid property in the metadata array
     */
    uidPropertyName: '_UID',
    /**
     * @property {Null|String}
     * The namespace of Ext.Direct stubs, will be loaded from the REMOTE_API configuration on {@link Bancha#init}.  
     * null means no namespace, this is not recommanded. The namespace can be set in CakePHP: Configure:write('Bancha.namespace','Bancha.RemoteStubs'); 
     */
    namespace: null,
    /**
     * @private
     * @property
     * The namespace in which all Bancha models are initialized to. Please only change BEFORE for creation of any Bancha model.
     * There's normally no need to change this. (Default: 'Bancha.model')
     */
    modelNamespace: 'Bancha.model',
    /**
     * @private
     * @property
     * Indicates that Bancha is initialized. Used for debugging.
     */
    initialized: false,
    /**
     * @private
     * Safely finds an object, used internally for getStubsNamespace and getRemoteApi
     * (This function is tested in RS.util, not part of the package testing, but it is tested)
     * @param {String} path A period ('.') separated path to the desired object (String).
     * @param {String} lookIn (optional) The object on which to perform the lookup.
     * @param {String} prototypes (optional) False to not look in prototypes (to be tested)
     * @return {Object} The object if found, otherwise undefined.
     */
    objectFromPath: function (path, lookIn, prototypes) {
        if(typeof path === 'number') { // for array indexes
            path = path+''; // to string
        }
        if(typeof path !== 'string') {
            return undefined;
        }
        prototypes = (typeof prototypes === 'undefined') ? true : prototypes; // true is default
        
        if (!lookIn) {
            //get the global object so it don't use hasOwnProperty on window (IE incompatible)
            var first = path.indexOf('.'),
                globalObjName,
                globalObj;
            if (first === -1) {
                // the whole path is only one object, so return the object
                return Ext.global[path];
            }
            // else use the first part as global object name
            globalObjName = path.slice(0, first);
            globalObj = Ext.global[globalObjName];
            if (typeof globalObj === 'undefined') {
                // path seems to be false
                return undefined;
            }
            // set the new lookIn and the path
            lookIn = globalObj;
            path = path.slice(first + 1);
        }
        // get the object
        return path.split('.').reduce(function(o, p) {
            if(o && (prototypes || o.hasOwnProperty(p))) {
                return o[p];
            }
        }, lookIn);
    },
    /**
     * @private
     * Returns the namespace of the remote stubs
     * @return {Object} The namespace if already instanciated, otherwise undefined
     */
    getStubsNamespace: function() {
        // IFDEBUG
        if(!this.initialized) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Bancha is not yet initalized, please init before using Bancha.getStubsNamespace().'
            });
        }
        // ENDIF
        return this.objectFromPath(this.namespace);
    },
    /**
     * Returns remote stubs for a given cake controller name in singular
     * @param {String} stubName the cakephp controller name in singular
     * @return {Object} The stub if already defined, otherwise undefined
     */
    getStub: function(stubName) {
        if(!Bancha.initialized) {
            Bancha.init();
        }
        // IFDEBUG
        if(!Ext.isObject(Bancha.getStubsNamespace()[stubName])) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: The Stub '+stubName+' doesn\'t exist'
            });
        }
        // ENDIF
        return Bancha.getStubsNamespace()[stubName] || undefined;
    },
    /**
     * @private
     * Returns the remote api definition of Ext.direct
     * @return {Object} The api if already defined, otherwise undefined
     */
    getRemoteApi: function() {    
        // IFDEBUG
        if(!Ext.isString(this.remoteApi)) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Bancha.remoteApi is not yet defined, please define the api before using Bancha.getRemoteApi().'
            });
        }
        if(!Ext.isObject(this.objectFromPath(this.remoteApi))) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: The remote api '+this.remoteApi+' is not yet defined, please define the api before using Bancha.getRemoteApi().'
            });
        }
        // ENDIF
        return this.objectFromPath(this.remoteApi);
    },
    /**
     * @deprecated Bancha internally calls this function, you don't need to explicitly use it anymore
     * Inits Bancha with the RemotingProvider, always init before using Bancha.  
     * ({@link Bancha#onModelReady} will init automatically)
     */
    init: function() {
        var remoteApi,
            regex,
            defaultErrorHandle,
            scripts,
            foundApi = false,
            apiPath,
            response,
            result;
        
        // IFDEBUG

        // show all initialize errors as message
        defaultErrorHandle = Ext.Error.handle;
        Ext.Error.handle = function(err) {
            Ext.Msg.alert('Bancha Error', err.msg);
        };

        if(Ext.versions.extjs && !Ext.isReady) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Bancha should be initalized after the onReady event.'
            });
        }
        
        if(!Ext.isObject(this.objectFromPath(this.remoteApi))) {

            // the remote api is not available, check if this is because of an error on the bancha-api.js or because it is not included
            scripts = Ext.DomQuery.select('script');
            Ext.each(scripts, function(script) {
                if(script.src && (script.src.search(/bancha-api\.js/)!==-1 || script.src.search(/bancha-api\/models\/([A-Za-z]*)\.js/)!==-1)) {
                    // the bancha-api seems to be included
                    foundApi = true;
                    apiPath = script.src;
                }
            });

            if(!apiPath) {
                // try in the root directory
                apiPath = '/bancha-api.js';
            }

            // load the api
            response = Ext.Ajax.request({
                url: apiPath,
                async: false
            });

            if(!foundApi) {
                // user just forgot to include the api
                Ext.Error.raise({
                    plugin: 'Bancha',
                    msg: [
                        '<b>Bancha Configuration Error:</b><br />',
                        'Please include the Bancha API before using Bancha by adding into your html:<br /><br />',
                        response.status===200 ? 
                            '<i>&lt;script type=&quot;text/javascript&quot; src=&quot;/bancha-api.js&quot;&gt;&lt;/script&gt;</i>' :
                            '<i>&lt;script type=&quot;text/javascript&quot; src=&quot;path/to/your/webroot/bancha-api.js&quot;&gt;&lt;/script&gt;</i>'
                    ].join('')
                });
            }

            if(response.status === 404) {
                //the api is included, but there seems to be an error
                Ext.Error.raise({
                    plugin: 'Bancha',
                    msg: [
                        '<b>Bancha Configuration Error:</b><br />',
                        'You have an error in your <a href="'+apiPath+'">Bancha API</a>, please fix it:<br /><br />',

                        response.responseText.search(/<h2>Not Found<\/h2>/)!==-1 ? '<b>Note: You might have to turn ob debug mode to get a usefull error message!</b><br/><br/>' : '',

                        response.responseText.substr(0,31) === '<script type="text/javascript">' ? // remote the script tags
                            response.responseText.substr(31,response.responseText.length-31-9) : 
                            response.responseText
                    ].join('')
                });
            }

            if(response.responseText.search(/Parse error/)!==-1 || response.responseText.search(/cake-error/)!==-1) {
                // there is an php error in cake
                Ext.Error.raise({
                    plugin: 'Bancha',
                    msg: [
                        '<b>CakePHP Error:</b><br />',
                        'You have an php error in your code:<br /><br />',

                        response.responseText.substr(0,31) === '<script type="text/javascript">' ? // remote the script tags
                            response.responseText.substr(31,response.responseText.length-31-9) : 
                            response.responseText
                    ].join('')
                });
            }

            // general error message
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: [
                    '<b>Unknown Error in Bancha API:</b><br />',
                    'You have an error in your <a href="'+apiPath+'">Bancha API</a>, please open the API for details.<br />',
                    'Note: You might have to turn ob debug mode to get a usefull error message!<br />'
                ].join('')
            });
        }
        
        if(this.initialized) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Bancha is initalized twice, please just initialize once.'
            });
        }
        // ENDIF

        // set the flag to true now
        this.initialized = true;

        remoteApi = this.getRemoteApi();

        // IFDEBUG
        if(remoteApi && remoteApi.metadata && remoteApi.metadata._ServerError) {
            // there is an cake error
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: [
                    '<b>CakePHP Error:</b><br />',
                    'You have an error in your cakephp code:<br /><br />',
                    Ext.isString(remoteApi.metadata._ServerError) ? 
                        remoteApi.metadata._ServerError : 
                        'Please turn the cakephp debug mode on to see the error message!'
                ].join('')
            });
        }
        // ENDIF

        // init error logging in production mode
        if(Bancha.getDebugLevel()===0 && (typeof TraceKit !== 'undefined') && TraceKit.report && Ext.isFunction(TraceKit.report.subscribe)) {
            TraceKit.report.subscribe(function(stackInfo) {
                // make sure to not bind the function, but the locaton (for later overriding)
                Bancha.onError(stackInfo);
            });
        }

        // if the server didn't send an metadata object in the api, create it
        if(!Ext.isDefined(remoteApi.metadata)) {
            remoteApi.metadata = {};
        }
        
        this.decodeMetadata(remoteApi);
        
        // IFDEBUG
        if(Ext.isObject(remoteApi)===false) {
            Ext.Error.raise({
                plugin: 'Bancha',
                remoteApi: this.remoteApi,
                msg: 'Bancha: The Bancha.remoteApi config seems to be configured wrong. (see also CakePHPs Configure:write(\'Bancha.remote_api\'Bancha.REMOTE_API\');'
            });
        }
        // ENDIF
        
        this.namespace = remoteApi.namespace || null;
        
        // init Provider
        Ext.direct.Manager.addProvider(remoteApi);
        
        //IFDEBUG
        // test if the bancha dispatcher is available
        response = Ext.Ajax.request({
            url: remoteApi.url+'?setup-check=true',
            async: false
        });
        try {
            result = Ext.decode(response.responseText, true);
        } catch(e) {
            // handle below
        }
        if(response.status!==200 || !Ext.isObject(result) || !result.BanchaDispatcherIsSetup) {

            // this might be just an update issue
            // check if the old name (bancha.php) still works
            response = Ext.Ajax.request({
                url: remoteApi.url.replace(/bancha-dispatcher\.php/, 'bancha.php')+'?setup-check=true',
                async: false
            });
            try {
                result = Ext.decode(response.responseText, true);
            } catch(e) {
                // There are many errors, let the user first rename the Bancha dispatcher and then fix the other
            }
            if(response.status===200 && Ext.isObject(result) && result.BanchaDispatcherIsSetup) {
                // old bancha dispatcher is still available
                Ext.Error.raise({
                    plugin: 'Bancha',
                    msg: [
                        '<b>Bancha Update Error:</b><br />',
                        'Since 1.1.0 the Bancha Dispatcher got renamed from "bancha.php" to "bancha-dispatcher.php".<br /><br />',
                        '<b>Please rename the file <i>app/webroot/bancha.php</i> to <i>bancha-dispatcher.php</i><br />'
                    ].join('')
                });
            }

            Ext.Error.raise({
                plugin: 'Bancha',
                msg: [
                    '<b>Bancha Configuration Error:</b><br />',
                    'Bancha expects the Bancha Dispatcher to be reachable at <a href="'+remoteApi.url+'">'+remoteApi.url+'</a>.<br /><br />',
                    '<b>Probably you just forgot to copy the file <i>Bancha/_app/webroot/bancha-dispatcher.php</i> into your app at <i>app/webroot/bancha-dispatcher.php</i><br />',
                    'Please do this and then reload the page.</b>'
                ].join('')
            });
        }

        // reset to default error handler
        Ext.Error.handle = defaultErrorHandle;

        // ENDIF

        // In Cake Debug mode set up all default error handlers
        if(this.getDebugLevel()!==0) { // this works only when this.initialized===true
            this.setupDebugErrorHandler();
        }
    },
    /**
     * If you are using Banchas debug version and CakePHP is in debug mode this function will be used when Bancha initializes
     * to setup debugging error handlers.
     * In production mode this function will be empty. This function is only triggered when cakes debug level is greater then zero.
     */
    setupDebugErrorHandler: function() {

        //IFDEBUG
        // catch every debug exception thrown from either ExtJS or Bancha
        Ext.Error.handle = function(err) {
            Ext.Msg.alert('Error', err.msg);
        };

        // catch server-side errors
        Ext.direct.Manager.on('exception', function(err){
            // normalize ExtJS and Sencha Touch
            var data = (typeof err.getCode === 'function') ? {
                code: err.getCode(),
                message: err.getMessage(),
                data: {
                    msg: err.getData()
                },

                // bancha-specific
                exceptionType: err.config.exceptionType,
                where: err.config.where,
                trace: err.config.trace
            } : err;
            
            // handle error
            if(data.code==="parse") {
                // parse error
                Ext.Msg.alert('Bancha: Server-Response can not be decoded',data.data.msg);
            } else {
                // exception from server
                Ext.Msg.alert('Bancha: Exception from Server',
                    "<br/><b>"+(data.exceptionType || "Exception")+": "+data.message+"</b><br /><br />"+
                    ((data.where) ? data.where+"<br /><br />Trace:<br />"+data.trace : "<i>Turn on the debug mode in cakephp to see the trace.</i>"));
            }
        });
        //ENDIF
    },
    /**
     * @private
     * @method
     * Decodes all stuff that can not be directly send in the right format from the server
     * Directly applies the changes
     */
    decodeMetadata: (function() {
    
        // since json doesn't support regex and json_encode fucks excaping up, transform bancha strings to real reggex
        var regex = {
            Alpha: /^[a-zA-Z_]+$/,
            Alphanum: /^[a-zA-Z0-9_]+$/,
            Email: /^(\w+)([\-+.][\w]+)*@(\w[\-\w]*\.){1,5}([A-Za-z]){2,6}$/,
            Url: /(((^https?)|(^ftp)):\/\/([\-\w]+\.)+\w{2,3}(\/[%\-\w]+(\.\w{2,})?)*(([\w\-\.\?\\\/+@&#;`~=%!]*)(\.\w{2,})?)*\/?)/i
        };
        
        
        return function(remoteApi) {
            Ext.Object.each(remoteApi.metadata, function(key,model) {
                Ext.Object.each(model.validations, function(key,rule) {
                    if(rule.type==='format' && Ext.isString(rule.matcher) && rule.matcher.substr(0,6)==='bancha' && regex[rule.matcher.substr(6)]) {
                        rule.matcher = regex[rule.matcher.substr(6)];
                    }
                });
            });
        };
    }()), //eo decodeMetadata
     
    /**
     * @deprecated Instead of preloading dependencies imperatively, use the uses
     * property on classes to load optional classes. Description below is from Bancha 1.3
     * 
     * Preloads the models metadata from the server to create a new model.  
     *  
     * __When to use it:__ You should use this function if you don't want to load 
     * the metadata at startup, but want to load it before it is (eventually) 
     * used to have a more reactive interface.  
     * 
     * __Attention:__ In most cases it's best to load all model metadata on startup
     * when the api is loaded, please see the Bancha CakePHP install guide for more 
     * information. This is mostly usefull if you can guess that a user will need a 
     * model soon which wasn't loaded at startup or if you want to load all needed
     * models right after startup with something like: 
     *     Ext.onReady(
     *         Ext.Function.createDelayed(
     *             function() { Bancha.preloadModelMetaData(['User','Article','Post']); },
     *             100 // after 100ms the whole ui should be already ready
     *         )
     *     );
     *
     * @param {Array|String} models    An array of the models to preload or a string with one model name
     * @param {Function}     callback  (optional) A callback function
     * @param {Object}       scope     (optional) The scope of the callback function
     */
    preloadModelMetaData: function(modelNames,callback,scope) {
        this.loadModelMetaData(modelNames,callback,scope,false);
    },
    /**
     * @private
     * Returns the url to load the metadata. Simple separation of concerns for better debugging and testing.
     *
     * @since Bancha v 2.0.0
     * @param  {Array}  modelNames An array of model names to load
     * @return {String}            The url to load model metadata via ajax
     */
    getMetaDataAjaxUrl: function(modelNames) {
        // IFDEBUG
        if(!Bancha.REMOTE_API) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: The Bancha.getMetaDataAjaxUrl requires the Bancha.REMOTE_API to be loaded to get the url.'
            });
        }
        // ENDIF

        var directUrl = Bancha.REMOTE_API.url,
            baseUrl = directUrl.substr(0, directUrl.lastIndexOf('/')+1 || 0);
        baseUrl = baseUrl || '/'; // if the direct url does not contain an slash
        return baseUrl+'bancha-load-metadata/['+modelNames+'].js';
    },
    /**
     * @private
     * This function loads model metadata from the server to create a new model definition.  
     *
     * This function should not be directly used, instead require model classed in your class
     * definitions.
     * 
     * @since Bancha v 2.0.0
     * @param {Array|String}  models            An array of the models to preload or a string with one model name
     * @param {Function}      callback          (optional) A callback function
     * @param {Boolean}       callback.success  True is successful, otherwise false.
     * @param {String}        callback.errorMsg If an error occured, this is the reeason.
     * @param {Object}        scope             (optional) The scope of the callback function
     * @param {Boolean}       syncEnabled       (optional) To to load synchronously (Defualt: false)
     * @return {void}
     */
    loadModelMetaData: function(modelNames, callback, scope, syncEnabled) {

        // make sure Bancha is initialized
        if(!Bancha.initialized) {
            Bancha.init();
        }

        // get remote stub function
        var fn, cb, directUrl, url;

        // IFDEBUG
        if(!Bancha.REMOTE_API) { // with syncEnable needed for getMetaDataAjaxUrl, otherwise for Ext.Direct
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: The Bancha.loadModelMetaData requires the Bancha.REMOTE_API to be loaded.'
            });
        }
        // ENDIF
        
        // IFDEBUG
        Ext.each(modelNames, function(modelName) {
            if(Ext.isObject(Bancha.getModelMetaData(modelName))) {
                if(Ext.global.console && Ext.isFunction(Ext.global.console.warn)) {
                    Ext.global.console.warn(
                        'Bancha: The model '+modelName+' is already loaded, we will reload the meta data '+
                        'but this seems strange. Notice that this warning is only created in debug mode.');
                }
            }
        });
        // ENDIF
        
        // force models to be an array
        if(Ext.isString(modelNames)) {
            modelNames = [modelNames];
        }

        // create the callback
        cb = Ext.Function.pass(this.onModelMetaDataLoaded, [callback, scope, modelNames], this);

        if(syncEnabled) {
            // start synchronous ajax request (Ext.Direct does not support synchronous requests)
            Ext.Ajax.request({
                url: this.getMetaDataAjaxUrl(modelNames),
                async: false,
                success: function(response) {
                    // prepare a Ext.Direct-like result
                    var result = {
                        success: true,
                        data: Ext.decode(response.responseText)
                    };

                    // trigger callback
                    cb(result);
                },
                failure: function(response, opts) {

                    // error, tell user
                    callback = callback || Ext.emptyFn;
                    scope = scope || Ext.global;
                    callback.call(scope, false, 'Server-side failure with status code '+response.status);
                }
            });
        } else {
            // start async Ext.Direct request
            fn = this.objectFromPath(this.metaDataLoadFunction,this.getStubsNamespace());

            // IFDEBUG
            if(!Ext.isFunction(fn)) {
                Ext.Error.raise({
                    plugin: 'Bancha',
                    metaDataLoadFunction: this.metaDataLoadFunction,
                    msg: 'Bancha: The Bancha.metaDataLoadFunction config seems to be configured wrong.'
                });
            }
            // ENDIF

            fn(modelNames,cb,Bancha);
        }
    }, 
    /**
     * @private
     * This function is triggered when the server returned the metadata, loaded via #loadModelMetaData.
     * 
     * @since Bancha v 2.0.0
     * @param {Array|String}  models            An array of the models to preload or a string with one model name
     * @param {Function}      callback          (optional) A callback function
     * @param {Boolean}       callback.success  True is successful, otherwise false.
     * @param {String}        callback.errorMsg If an error occured, this is the reeason.
     * @param {Object}        scope             (optional) The scope of the callback function
     * @param {Object|null}   result            A result object, containing a success and data property
     * @return {void}
     */
    onModelMetaDataLoaded: function(callback, scope, modelNames, result) {
        // IFDEBUG
        if(result===null) {
            Ext.Error.raise({
                plugin: 'Bancha',
                result: result,
                event: event,
                msg: 'Bancha: The Bancha.loadModelMetaData('+modelNames.toString()+',..) expected to get the metadata from the server, instead got: '+Ext.encode(result)
            });
        }
        // ENDIF
        
        // error handling
        if(!result.success) {
            callback = callback || Ext.emptyFn;
            scope = scope || Ext.global;
            callback.call(scope, false, result.message);
        }
        // save result
        Ext.apply(Bancha.getRemoteApi().metadata, result.data);
        
        // decode new stuff
        this.decodeMetadata(Bancha.getRemoteApi());
    
        // IFDEBUG
        if(!Ext.isFunction(callback) && Ext.isDefined(callback)) {
            Ext.Error.raise({
                plugin: 'Bancha',
                callback: callback,
                msg: 'Bancha: The for Bancha.loadModelMetaData supplied callback is not a function.'
            });
        }
        if(!Ext.isObject(scope) && Ext.isDefined(scope)) {
            Ext.Error.raise({
                plugin: 'Bancha',
                scope: scope,
                msg: 'Bancha: The for Bancha.loadModelMetaData supplied scope is not a object.'
            });
        }
        // ENDIF

        // user callback
        callback = callback || Ext.emptyFn;
        scope = scope || Ext.global;
        callback.call(scope, true, 'Successfully loaded '+modelNames.toString());
    },
    /**
     * Checks if the model is supported by the server
     * Todo: This currently doesn't check if the exposed Object is an Controller method or an exposed model
     * @param {String} modelName The name of the model
     * @return {Boolean} True is the model is remotable
     */
    isRemoteModel: function(modelName) { // TODO refactor to isRemotableModel
        return (
                Ext.isObject(this.getStubsNamespace()) && 
                Ext.isObject(this.getStubsNamespace()[modelName])
                ) ? true : false;
    },
    
    /**
     * Checks if the metadata of a model is loaded.
     * @param {String} modelName The name of the model
     * @return {Boolean} True is the metadata is present for _modelName_
     */
    modelMetaDataIsLoaded: function(modelName) {
        var api = this.getRemoteApi();
        return (
                Ext.isObject(api) && 
                Ext.isObject(api.metadata) &&
                Ext.isObject(api.metadata[modelName])
                ) ? true : false;
    },
    
    /**
     * Loads and instanciates a model if not already done and then
     * calls the callback function.  
     * 
     * If Bancha is not already initialized it will wait for {@link http://docs.sencha.com/ext-js/4-1/#!/api/Ext-property-isReady Ext.isReady}
     * and calls {@link Bancha#init} before model creation.  
     * 
     * See {@link Bancha Bancha class explaination} for an example.
     * @param {String|Array} modelNames A name of the model or an array of model names
     * @param {Function} callback (optional) A callback function, the first argument is:  
     *  - a model class if input modelNames was an string  
     *  - an object with model names as keys and models as arguments if an array was given
     * @param {Object} scope (optional) The scope of the callback function
     */
    onModelReady: function(modelNames, callback, scope) {
        if(this.initialized) {
            this.onInitializedOnModelReady(modelNames, null, null, callback, scope);
        } else {
            Ext.onReady(function() {
                this.init();
                this.onInitializedOnModelReady(modelNames, null, null, callback, scope);
            },this);
        }
    },
    /**
     * @private
     * Helper, Bancha.onModelReady will call this function in an Ext.onReady
     * !!!don't use this function directly!!!
     */
    onInitializedOnModelReady: function(modelNamesToLoad, loadingModels, loadedModels, callback, scope) {
        
        // IFDEBUG
        if(!Ext.isFunction(callback)) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Please define a callback as the second param for Bancha.onModelReady(modelName,callback).'
            });
        }
        // ENDIF

        // defaults
        var modelsToLoad  = [],
            modelName,
            me = this;
        callback = callback || Ext.emptyFn;    
        scope = scope || {}; // sandbox is no scope is set, way easier to debug then window
        loadingModels = loadingModels || {};
        loadedModels  = loadedModels  || {};
        
        // handle single model request (simple and different callback argument)
        modelName = (modelNamesToLoad.length===1) ? modelNamesToLoad[0] : modelNamesToLoad;
        if(Ext.isString(modelName)) {
            
            if(this.modelMetaDataIsLoaded(modelName)) {
                // all metadata already present, call callback with model
                callback.call(scope,this.getModel(modelName));
            } else {
                this.preloadModelMetaData(modelName, function() {
                    // all metadata already present, call callback with model
                    callback.call(scope,this.getModel(modelName));
                },this);
            }
            return;
        }
        
        if(!Ext.isArray(modelNamesToLoad)) {
            // IFDEBUG
            Ext.Error.raise({
                plugin: 'Bancha',
                modelNamesToLoad: modelNamesToLoad,
                msg: 'Bancha: The Bancha.onModelReady(modelNamesToLoad) expects either a string with one model oder an array of models, instead got'+modelNamesToLoad.toString()+' of type '+(typeof modelNamesToLoad)
            });
            // ENDIF
            return false;
        }
        
        // iterate trought the models to load
        Ext.Array.forEach(modelNamesToLoad, function(modelName) {
            if(me.modelMetaDataIsLoaded(modelName)) {
                loadedModels[modelName] = me.getModel(modelName);
            } else {
                modelsToLoad.push(modelName);
            }
        });
        
        // iterate trought the loading models
        Ext.each(loadingModels, function(modelName) {
            if(me.modelMetaDataIsLoaded(modelName)) {
                // that was the model which triggered the function, so we are finished here
                loadedModels[modelName] = me.getModel(modelName);
                return false; // stop
            }
        });
        
        if(modelsToLoad.length===0) {
            // all metadata already present, call callback
            callback.call(scope,loadedModels);
        } else {
            // add all elements to the queue
            me.preloadModelMetaData(modelsToLoad, function() {
                // when model is loaded try again
                me.onInitializedOnModelReady([], loadingModels, loadedModels, callback, scope);
            },me);
        }
    },
    /**
     * @private
     * Get the metadata of an model
     * @param {String} modelName The name of the model
     * @return {Object|null} Returns an objects with all metadata or null if not loaded yet.
     */
    getModelMetaData: function(modelName) {
        // IFDEBUG
        if(!this.initialized) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Please inistalize Bancha before using it\'s getModelMetaData() method.'
            });
        }
        
        if(!Ext.isObject(this.getRemoteApi())) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha:The Bancha.remoteApi is configured wrong, this should be automatically refer to the REMOTE_API object, maybe due a misconfigured server.'
            });
        }
        if(!Ext.isObject(this.getRemoteApi().metadata)) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: The server served a REMOTE_API object without a metadata property, maybe due a misconfigured server or a non-banacha backend system.'
            });
        }
        // ENDIF
        
        if(this.modelMetaDataIsLoaded(modelName)) {
            // metadata found, clone it to prevent unobvious errors (ext always uses the config object and modifies it
            return Ext.clone(
                this.getRemoteApi().metadata[modelName]);
        }
        
        // nothing found
        return null;
    },
    
    /**
     * @private
     * Returns the UID of this instance or false in an error case.
     * In debug mode it throws an error if no UID is defined.
     */
    getConsistentUid: function() {
        var api = this.getRemoteApi();
        // IFDEBUG
        if(!this.initialized) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: Please inistalize Bancha before using it\'s getConsistentUid() method.'
            });
        }
        
        if(!(
             Ext.isObject(api) && 
             Ext.isObject(api.metadata) &&
             Ext.isString(api.metadata[this.uidPropertyName])
             )) {
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Bancha: There is no Bancha consistent model uid defined in the metadata. '+
                     'Maybe you use a non-Bancha backend or forgot to include the remote api on this site.'
            });
         }
         // ENDIF
         return (api && api.metadata && api.metadata[this.uidPropertyName]) ? api.metadata[this.uidPropertyName] : false;
    },
    /**
     * Returns the current CakePHP debug level
     * 
     * @param {Number} defaultValue (optional) The number to return if the Remote API is not yet initialized (Default: undefined)
     * @return the current debug level, or if not available the default
     */
    getDebugLevel: function(defaultValue) {
        if(!this.initialized) {
            return defaultValue;
        }
        
        var api = this.getRemoteApi();
        return (api && api.metadata && Ext.isDefined(api.metadata._ServerDebugLevel)) ? api.metadata._ServerDebugLevel : defaultValue;
    },
    /**
     * This is a synonym for {Bancha.Logger.log}
     * 
     * @param  {String}  message        The error message
     * @param  {String}  type           (optional) Either 'error', 'warn' or 'missing_translation' (default is 'error')
     * @param  {Boolean} forceServerlog (optional) True to write the error to the server, even in debug mode (default to false)
     * @return void
     */
    log: function(message, type, forceServerlog) {
        if(!Bancha.Logger) {
            // IFDEBUG
            Ext.Error.raise({
                plugin: 'Bancha',
                msg: 'Tried to use Bancha.log, but the necessarry class Bancha.Logger is not present'
            });
            // ENDIF
            if(Ext.global.console && Ext.global.console.error) {
                Ext.global.console.error('Tried to use Bancha.log, but the necessarry class Bancha.Logger is not present');
            }
            return;
        }
        return Bancha.Logger.log.apply(Bancha.Logger,arguments);
    },
    /**
     * In production mode (or if errors occur when Bancha is not initialized) this function will be called. 
     * This function will log the error to the server and then throw it.
     * You can overwrite this function with your own implementation at any time.
     *
     * @param {Object} stackInfo an TraceKit error object, see also {@link https://github.com/Bancha/TraceKit TraceKit}
     * @return void
     */
    onError: function(stackInfo) {

        // just log the error
        // depending on debug level this is logged 
        // to the console or to the server
        Bancha.log(Ext.encode(stackInfo), 'error');
    },
    /**
     * @property {Function|False} onRemoteException
     * This function will be added to each model to handle remote errors.
     * (modelConfig.listeners.exception).  
     * Use false to don't have exception handling on models.
     */
     onRemoteException: function(proxy, response, operation){
         Ext.MessageBox.show({
             title: 'REMOTE EXCEPTION',
             msg: operation.getError(),
             icon: Ext.MessageBox.ERROR,
             buttons: Ext.Msg.OK
         });
     },
    

	/**
     * Checks if a Bancha model is already created (convinience function)
     * 
     * @param {String} modelName The model name (without any namespace)
     * @return {Boolean} True if the model exists
     */
	isCreatedModel: function(modelName) {
		return Ext.ClassManager.isCreated(Bancha.modelNamespace+'.'+modelName);
	},
	
    /**
     * @deprecated Please only define your model on the backend to have a clean separation of concerns. 
     * This function will be removed soon.
     * 
     * This method creates a {@link Bancha.data.Model} with your additional model configs,
     * if you don't have any additional configs just use the convienience method {@link #getModel}.  
     * 
     * In the debug version it will raise an Ext.Error if the model can't be 
     * or is already created, in production it will only return false.
     * 
     * @param {String} modelName The name of the model
     * @param {Object} modelConfig A standard Ext.data.Model config object
                                   In ExtJS this will be directly applied.
                                   In Sencha Touch this iwll be applied to the config property.
     * @return {Boolean} Returns true is model was created successfully
     */
    createModel: function(modelName, modelConfig) {
        var metaData,
            defaults,
            // IFDEBUG
            safeDirectFn,
            // ENDIF
            stub,
            idProperty,
            configWithRootPropertySet;
        
        // IFDEBUG
        if(Ext.isDefined(modelConfig) && Ext.Logger && Ext.Logger.deprecate) {
            Ext.Logger.deprecate('Bancha.created is deprecated and will be removed soon. Please only define your model on the backend to have a clean separation of concerns.', 1);
        }
        // ENDIF

        if(!Bancha.initialized) {
            Bancha.init();
        }
        
        if(!this.isRemoteModel(modelName)) {
            // IFDEBUG
            Ext.Error.raise({
                plugin: 'Bancha',
                modelName: modelName,
                modelConfig: modelConfig,
                msg: 'Bancha: Couldn\'t create the model "'+modelName+'" cause the model is not supported by the server (no remote model).'
            });
            // ENDIF
            return false;
        }
        
        if(!this.modelMetaDataIsLoaded(modelName)) {
            // IFDEBUG
            Ext.Error.raise({
                plugin: 'Bancha',
                modelName: modelName,
                modelConfig: modelConfig,
                msg: 'Bancha: Couldn\'t create the model cause the metadata is not loaded yet, please use onModelReady instead.'
            });
            // ENDIF
            return false;
        }
        
        if(Bancha.isCreatedModel(modelName)) {
            // IFDEBUG
            Ext.Error.raise({
                plugin: 'Bancha',
                modelName: modelName,
                modelConfig: modelConfig,
                msg: 'Bancha: The model class '+modelName+' is already defined.'
            });
            // ENDIF
            return false;
        }
        
        // IFDEBUG
        if(!Ext.isDefined(this.getModelMetaData(modelName).idProperty)) {
            if(Ext.global.console && Ext.isFunction(Ext.global.console.warn)) {
                Ext.global.console.warn(
                    'Bancha: The model meta data for '+modelName+' seems strange, probably this was '+
                    'not created by Bancha, or an error occured on the server-side. Please notice '+
                    'that this warning is only created in debug mode.');
            }
        }
        // ENDIF
        
        // IFDEBUG
        safeDirectFn = function(stub,method,modelName) {
            if(Ext.isDefined(stub[method] && typeof stub[method] === 'function')) {
                return stub[method];
            }
            
            // function doesn't exit, create fake which will throw an error on first use
            var map = {
                    create : 'add',
                    read   : 'view or index',
                    update : 'edit',
                    destroy: 'delete'
                },
                fakeFn = function() {
                    Ext.Error.raise({
                        plugin: 'Bancha',
                        modelName: modelName,
                        msg: 'Bancha: Tried to call '+modelName+'.'+method+'(...), but the server-side has not implemented '+modelName+'sController->'+ map[method]+'(...). (If you have special inflection rules, the serverside is maybe looking for a different controller name, this is jsut a guess)'
                    });
                };
            
            // this is not part of the official Ext API!, but it seems to be necessary to do this for better bancha debugging
            fakeFn.directCfg = { // TODO testen
                len: 1,
                name: method,
                formHandler: false
            };
            // fake the execution method
            fakeFn.directCfg.method = function() {
                Ext.Error.raise({
                    plugin: 'Bancha',
                    modelName: modelName,
                    msg: 'Bancha: Tried to call '+modelName+'.'+method+'(...), but the server-side has not implemented '+modelName+'sController->'+ map[method]+'(...). (If you have special inflection rules, the serverside is maybe looking for a different controller name, this is jsut a guess)'
                });
            };
            
            return fakeFn;
        }; 
        // ENDIF

        // Sencha Touch uses the new rootProperty property for configuring the reader and writer
        // ExtJS still uses root. 
        // This all would be fine, but now Sencha Touch throws deprecated warning for using the old
        // ExtJS syntax, so we can't just assign both anymore, instead we need to create a config
        // prototype here
        if(Ext.versions.touch) {
            configWithRootPropertySet = {
                rootProperty: 'data'
            };
        } else {
            configWithRootPropertySet = {
                root: 'data'
            };
        }

        // create the metadata
        modelConfig = modelConfig || {};
        stub = this.getStubsNamespace()[modelName];
        idProperty = this.getModelMetaData(modelName).idProperty;
        defaults = {
            extend: 'Bancha.data.Model',
            idProperty: idProperty,
            proxy: {
                type: 'direct', // TODO batch requests: http://www.sencha.com/forum/showthread.php?156917
                batchActions: false, // don't batch requests on the store level, they will be batched batched by Ext.Direct on the application level
                api: {
                    /* IFPRODUCTION
                    // if method is not supported by remote it get's set to undefined
                    read    : stub.read,
                    create  : stub.create,
                    update  : stub.update,
                    destroy : stub.destroy
                    ENDIF */
                    // IFDEBUG
                    read    : safeDirectFn(stub,'read',modelName),
                    create  : safeDirectFn(stub,'create',modelName),
                    update  : safeDirectFn(stub,'update',modelName),
                    destroy : safeDirectFn(stub,'destroy',modelName)
                    // ENDIF
                },
                // because of an error in ext the following directFn def. has to be 
                // defined, which should be read from api.read instead...
                // see http://www.sencha.com/forum/showthread.php?134505-Model-proxy-for-a-Store-doesn-t-seem-to-work-if-the-proxy-is-a-direct-proxy&p=606283&viewfull=1#post606283
                /* IFPRODUCTION
                directFn: stub.read,
                ENDIF */
                // IFDEBUG
                directFn: safeDirectFn(stub,'read',modelName),
                // ENDIF
                reader: Ext.apply({
                    type: 'json',
                    messageProperty: 'message'
                }, configWithRootPropertySet),
                writer: (modelConfig.forceConsistency) ? Ext.apply({
                    type: 'consitentjson',
                    writeAllFields: false
                }, configWithRootPropertySet) : Ext.apply({
                    type: 'jsondate',
                    writeAllFields: false
                }, configWithRootPropertySet),
                listeners: {
                    exception: this.onRemoteException || Ext.emptyFn
                }
            }
        };
        metaData = Ext.clone(this.getModelMetaData(modelName));
        modelConfig = Ext.apply(metaData, modelConfig, defaults);
        
        // The Sencha Touch and ExtJS model structure differ
        // Therefore we msut recognize here if it is a Touch version and
        // in this case adopt the config structure
        if(Ext.versions.touch) {
            // place all configs in the config property
            modelConfig = {
                extend: modelConfig.extend,
                config: modelConfig
            };
            
            // this one should only be on the model itself
            delete modelConfig.config.extend;
        }
        
        // create the model
        Ext.define(Bancha.modelNamespace+'.'+modelName, modelConfig);
        return true;
    },
    /**
     * Get a bancha model by name.  
     * If it isn't already defined this function will define the model.
     * 
     * In the debug version it will raise an Ext.Error if the model can't be created,
     * in production it will just return null.
     * @param {String} modelName The name of the model
     * @return {Ext.data.Model|null} Returns the model or null if this model doesn't exist or the metadata is not loaded
     * @member Bancha
     * @method getModel
     */
    getModel: function(modelName) {
        if(!Bancha.initialized) {
            Bancha.init();
        }
        return (this.isCreatedModel(modelName) || this.createModel(modelName)) ? Ext.ClassManager.get(Bancha.modelNamespace+'.'+modelName) : null;
    },

    /**
     * @singleton
     * @class Bancha.Localizer
     * Language support for Bancha.
     */
    Localizer: {
        /**
         * @property
         * The default language code for translations.   
         * Use the getter and setter methods!   
         * (Default: 'eng')
         */
        currentLang: 'eng',
        /**
         * Returns the default language for {@link Bancha.Localizer#getLocalizedString},
         * {@link Bancha.Localizer#getLocalizedStringWithReplacements} and {@link Bancha#t}.
         *
         * @return {String} The three letter code of the current language, as in cakephp, e.g. 'eng'
         */
        getCurrentLanguage: function() {
            return this.currentLang;
        },
        /**
         * Sets a new default language for {@link Bancha.Localizer#getLocalizedString},
         * {@link Bancha.Localizer#getLocalizedStringWithReplacements} and {@link Bancha#t}.
         *
         * @param {String} lang The three letter code of the new language, as in cakephp, e.g. 'eng'
         */
        setCurrentLanguage: function(lang) {
            this.currentLang = lang;
        },
        /**
         * You can use this function to preload translations.
         * @param {String} langCode A three letter language code, same as in cakephp (Default is {@link #currentLang} property)
         */
        preloadLanguage: function(langCode) {
            if (!this.locales) {
                this.locales = new Ext.util.HashMap();
            }
            this.loadLocaleStrings(langCode || this.currentLang, true);
        },
        /**
         * @private
         * @param {String} langCode A three letter language code, same as in cakephp
         * @param {Boolean} asnyc False to block while loading (Default: false)
         * @return {Array} the loaded array of translations
         */
        loadLocaleStrings: function(locale, async) {
            var me = this, localeStrings;
            Ext.Ajax.request({
                url: "/bancha/bancha/translations/" + locale + ".js",
                async: async || false,
                success: function(response) {
                    var entries = Ext.decode(response.responseText);
                    localeStrings = new Ext.util.HashMap();
                    Ext.each(entries, function(entry) {
                        localeStrings.add(entry.key, entry.value);
                    });
                    me.locales.add(locale, localeStrings);
                },
                failure: function() {
                    me.locales.add(locale, false);
                    localeStrings = false;
                }
            });
            return localeStrings;
        },
        /**
         * @private
         * @param {String} langCode A three letter language code, same as in cakephp
         * @return {Array} the loaded array of translations
         */
        getLocaleStrings: function(locale) {
            var me = this, localeStrings;
            if (!me.locales) {
                me.locales = new Ext.util.HashMap();
            }
            if (!me.locales.get(locale)) {
                localeStrings = me.loadLocaleStrings(locale);
            } else {
                localeStrings = me.locales.get(locale);
            }
            if (Ext.isBoolean(localeStrings) && !localeStrings) {
                // If locale key contains "false" we
                // tried to load the locale file before
                // but failed.
                return;
            }
            return localeStrings;
        },
        /**
         * Translates an given string to the given language.
         * 
         * If no locale is defined the language is taken from {@link #currentLang}.
         * 
         * @param {String} key The string to translate
         * @param {String} langCode A three letter language code, same as in cakephp (Default from {@link #currentLang})
         * @return {String} The translated string
         */
        getLocalizedString: function(key, locale) {
            var me = this,
                localeStrings,
                localized;

            key = key + ''; // string conversion

            locale = locale || this.currentLang;
            if (!key || !locale) {
                return key;
            }
            localeStrings = me.getLocaleStrings(locale);
            if (!localeStrings) {
                return key;
            }
            localized = localeStrings.get(key);
            // empty strings are intentional, so just return if it's undefined
            if (!Ext.isString(localized)) { 
                return key;
            }
            return localized;
        },
        /**
         * Translates an given string the current language
         * (see {@link #currentLang}).
         *
         * Additional arguments are used to replace %s (for string) and %d (for number).
         *
         * @param {String} key The string to translate
         * @param {String...} replacements An arbitrary number of additional strings used to replace %s (for string) and %d (for number) in the key string.
         * @return {String} The translated string
         */
        getLocalizedStringWithReplacements: function(key, replacement1, replacement2, replacement3) {
            // translate
            key = this.getLocalizedString(key);

            // replace %s and %d
            var bits = key.split('%'),
                result = bits[0],
                i, len, p;

            // IFDEBUG
            if(bits.length !== arguments.length) { // replacements+first substr should equal key+replacements
                Ext.Error.raise({
                    plugin: 'Bancha',
                    msg: 'Bancha.Localizer expected for the string "'+key+'" '+(bits.length-1)+' replacement(s), instead got '+(arguments.length-1)+'.'
                });
            }
            // ENDIF

            for(i=1, len=bits.length; i<len; i++) {
                switch(bits[i].substr(0,1)) {
                    case 'd':
                        result += parseInt(arguments[i], 10);
                        break;
                    case 's':
                        result += arguments[i];
                        break;
                    default: 
                        // IFDEBUG
                        Ext.Error.raise({
                            plugin: 'Bancha',
                            msg: 'Bancha.Localizer does not know how to replace %'+bits[i].substr(0,1)+' in string "'+key+'".'
                        });
                        // ENDIF
                        result += '%'+bits[i].substr(0,1);
                }
                result += bits[i].substr(1);
            }

            return result;
        }
    },
    /**
     * Translates an given string the current language
     * (see {@link Bancha.Localizer#currentLang}).
     *
     * Additional arguments are used to replace %s (for string) and %d (for number).
     *
     * This is a convenience function for {@link Bancha.Localizer#getLocalizedStringWithReplacements}.
     * 
     * @param {String} key The string to translate
     * @param {String...} replacements An arbitrary number of additional strings used to replace %s (for string) and %d (for number) in the key string.
     * @return {String} The translated string
     * @member Bancha
     */
    t: function(key,  replacement1, replacement2, replacement3) {
        return Bancha.Localizer.getLocalizedStringWithReplacements.apply(Bancha.Localizer, arguments);
    }
}, function() {
    /*
     * The Bancha class callback
     * Create deprecated warnings for old Bancha.log.*
     */

     // Ext.Logger might not be available
     var markDeprecated = function(msg) {
        if(Ext.Logger) {
            Ext.Logger.deprecate(msg);
        } else if(Bancha.Logger) {
            Bancha.Logger.warn('[DEPRECATE]'+msg);
        } else if(Ext.global.console && Ext.global.console.warn) {
            Ext.global.console.warn('[DEPRECATE]'+msg);
        }
    };

    // now initialize all deprecated log functions
    Bancha.log.info = function(msg) {
        markDeprecated('Bancha.log.info is deprecated in favor of Bancha.Logger.info', 1);
        if(Bancha.Logger) {
            Bancha.Logger.info.apply(Bancha.Logger, arguments);
        } else {
            Ext.Logger.info(msg);
        }
    };
    Bancha.log.warn = function(msg) {
        markDeprecated('Bancha.log.warn is deprecated in favor of Bancha.Logger.warn', 1);
        if(Bancha.Logger) {
            Bancha.Logger.warn.apply(Bancha.Logger, arguments);
        } else {
            Ext.Logger.warn(msg);
        }
    };
    Bancha.log.error = function(msg) {
        markDeprecated('Bancha.log.error is deprecated in favor of Bancha.Logger.error', 1);
        if(Bancha.Logger) {
            Bancha.Logger.error.apply(Bancha.Logger, arguments);
        } else {
            Ext.Logger.error(msg);
        }
    };
});




/**
 * @singleton
 * @class Bancha.Logger
 *
 * This class encalpsulates some logging features.
 * For more see {Bancha.Logger.log}
 * 
 * example usage:
 *     Bancha.log('My error message');
 *     Bancha.log('My info message','info');
 *     
 *     Bancha.Logger.info('My info message');
 *     Bancha.Logger.warn('My warning message');
 *     Bancha.Logger.error('My error message');
 * 
 */
Ext.define('Bancha.Logger', {
    singleton: true,
    requires: [
        'Bancha.Main'
    ],
    /**
     * This function logs a message.
     *
     * If the CakePHP debug level is 0 (production mode) or forceServerlog is
     * true, and the type is not 'info', then the error will be send to 
     * the server and logged to app/tmp/logs/js_error.log (for types 
     * 'error' and 'warn') and app/tmp/logs/missing_translation.log 
     * (for type 'missing_translation').
     *
     * If the debug level is bigger then zero and a console is availabe
     * it is written to the console. If no console is available it is
     * instead displayed as a Ext.Msg.alert.
     * 
     * @param  {String}  message        The error message
     * @param  {String}  type           (optional) Either 'error', 'warn' or 'missing_translation' (default is 'error')
     * @param  {Boolean} forceServerlog (optional) True to write the error to the server, even in debug mode (default to false)
     * @return void
     */
    log: function(message, type, forceServerlog) {
        type = type || 'error';

        if(Bancha.getDebugLevel(0)===0 || forceServerlog) {
            if(type === 'info') {
                return; // don't log info messages
            }

            // log the error to the server

            // if not yet initalized try to initialize
            if(!Bancha.initialized) {
                try {
                    Bancha.init();
                } catch(error) {
                    // Bancha could not be initialized and we are in production mode
                    // suppress everything, and try to write to the console
                    Bancha.Logger.logToConsole(message, type);
                    return;
                }
            }

            // ok, now log it to the server
            var serverType = type==='missing_translation' ? type : 'js_error';
            message = (type==='warn' ? 'WARNING: ' : '') + message;
            Bancha.getStub('Bancha').logError(message, serverType);
            return;
        }

        // in debug mode
        Bancha.Logger.logToBrowser(message, type);

    },
    /**
     * Convenience function for logging with type 'info', see {@link Bancha.Logger.log}
     * 
     * @param  {String}  message        The info message
     * @param  {Boolean} forceServerlog (optional) True to write the error to the server, even in debug mode (default to false)
     * @return void
     */
    info: function(message, forceServerlog) {
        Bancha.Logger.log(message, 'info', forceServerlog || false);
    },
    /**
     * Convenience function for logging with type 'warn', see {@link Bancha.Logger.log}
     * 
     * @param  {String}  message        The warn message
     * @param  {Boolean} forceServerlog (optional) True to write the error to the server, even in debug mode (default to false)
     * @return void
     */
    warn: function(message, forceServerlog) {
        Bancha.Logger.log(message, 'warn', forceServerlog || false);
    },
    /**
     * Convenience function for logging with type 'error', see {@link Bancha.Logger.log}
     * 
     * @param  {String}  message        The error message
     * @param  {Boolean} forceServerlog (optional) True to write the error to the server, even in debug mode (default to false)
     * @return void
     */
    error: function(message, forceServerlog) {
        Bancha.Logger.log(message, 'error', forceServerlog || false);
    },
    /**
     * @private
     * This function writes logging information to the console or browser window.
     * 
     * If the console is availabe writes it there. If no console is available 
     * it is instead displayed as a Ext.Msg.alert.
     * 
     * @param  String message The logging message
     * @param  String type    Either 'error', 'warn', 'info' or 'missing_translation' (default is 'error')
     * @return void
     */
    logToBrowser: function(message, type) {
        type = type || 'error';
        var typeText = type.replace(/_/,' ').toUpperCase();

        if(Ext.global.console && typeof Ext.global.console.log === 'function') {
            // just use the console
            Bancha.Logger.logToConsole(message, type);
        } else {
            // There is no console, use alert
            Ext.Msg.alert(typeText, message);
        }
    },
    /**
     * @private
     * A wrapper for the window.console method
     * 
     * @param  String message The logging message
     * @param  String type    Either 'error', 'warn', 'info' or 'missing_translation' (default is 'error')
     * @return void
     */
    logToConsole: function(message, type) {
        type = type || 'error';
        var typeText = type.replace(/_/,' ').toUpperCase();

        if(type==='error' && typeof Ext.global.console.error === 'function') {
            Ext.global.console.error(message);
            return;
        }
        if((type==='warn' || type==='missing_translation') && typeof Ext.global.console.warn === 'function') {
            Ext.global.console.warn((type==='missing_translation' ? 'MISSING TRANSLATION: ' : '') + message);
            return;
        }
        if(type==='info' && typeof Ext.global.console.info === 'function') {
            Ext.global.console.info(message);
            return;
        }
        
        // there is no specific log function, use default log
        Ext.global.console.log(typeText+': '+message);
    }
});

// eof
