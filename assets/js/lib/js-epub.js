"use strict";

window.loading = false;

(function (GLOBAL) {
    var JSEpub = function (blob) {
        this.blob = blob;
        this.entries = null;
    };

    GLOBAL.canvas = document.createElement('canvas');
    GLOBAL.image = new Image();
    GLOBAL.ctx = GLOBAL.canvas.getContext("2d");

    GLOBAL.JSEpub = JSEpub;

    JSEpub.prototype = {

        getEntries: function(){
            var def = _.Deferred();
            var self = this;
            if(this.entries) {
                def.resolve();
            } else {
                zip.createReader(new zip.BlobReader(this.blob), function(reader) {

                    // get all entries from the zip
                    reader.getEntries(function(entries) {
                        self.entries = entries;
                        def.resolve();

                    });
                }, function(){
                    def.reject()
                });
            }

            return def;


        },

        getOpfPathFromContainer: function () {
            var doc = this.xmlDocument(this.container);
            return doc
                .getElementsByTagName("rootfile")[0]
                .getAttribute("full-path");
        },

        getOpf: function(){
//            var unzipper = this.unzipper(this.blob);
            var ret = _.Deferred();
            var self = this;

            this.getEntries().done(function(){
                var container = _.find(self.entries, function(entry){
                    return entry.filename == 'META-INF/container.xml'
                });

                container.getData(new zip.TextWriter('UTF-8'), function(text) {
                    // text contains the entry data as a String
                    self.container = text;
                    self.opfPath = self.getOpfPathFromContainer();

                    var opfFile = _.find(self.entries, function(entry){
                        return entry.filename == self.opfPath
                    });

                    opfFile.getData(new zip.TextWriter('UTF-8'), function(text) {
                        self.opf = self.readOpf(text);
                        ret.resolve();
                    })

                });

            }).fail(function(){
                ret.reject();
            });


            return ret;



        },

        getMimetype: function(){
            var ret = _.Deferred();

            var mime = _.find(this.entries, function(entry){
                return entry.filename == 'mimetype';
            });

            mime.getData(new zip.TextWriter('UTF-8'), function(text) {
//                console.log('mimetype', text);
                ret.resolve(text);
            });

            return ret;

        },

        readOpf: function (xml) {

//            xml = decodeURIComponent(escape(xml));
//            console.log(xml);
            var doc = this.xmlDocument(xml);
            var opf = {
                metadata: {},
                manifest: {},
                spine: []
            };

            var metadataNodes = doc
                .getElementsByTagName("metadata")[0]
                .childNodes;

            for (var i = 0, il = metadataNodes.length; i < il; i++) {
                var node = metadataNodes[i];
                // Skip text nodes (whitespace)
                if (node.nodeType === 3) { continue }

                var attrs = {};
                for (var i2 = 0, il2 = node.attributes.length; i2 < il2; i2++) {
                    var attr = node.attributes[i2];
                    attrs[attr.name] = attr.value;
                }
                attrs._text = node.textContent;
                opf.metadata[node.nodeName] = attrs;
            }

            var manifestEntries = doc
                .getElementsByTagName("manifest")[0]
                .getElementsByTagName("item");

            for (var i = 0, il = manifestEntries.length; i < il; i++) {
                var node = manifestEntries[i];

                opf.manifest[node.getAttribute("id")] = {
                    "href": this.resolvePath(node.getAttribute("href"), this.opfPath),
                    "media-type": node.getAttribute("media-type")
                }
            }

            var spineEntries = doc
                .getElementsByTagName("spine")[0]
                .getElementsByTagName("itemref");

            for (var i = 0, il = spineEntries.length; i < il; i++) {
                var node = spineEntries[i];
                opf.spine.push(node.getAttribute("idref"));
            }

            //this.opf = opf;
            this.bookId = eBook.hashCode(opf.metadata['dc:identifier']._text)+'';
            return opf;
        },

        resolvePath: function (path, referrerLocation) {
            var pathDirs = path.split("/");
            var fileName = pathDirs.pop();

            var locationDirs = referrerLocation.split("/");
            locationDirs.pop();

            for (var i = 0, il = pathDirs.length; i < il; i++) {
                var spec = pathDirs[i];
                if (spec === "..") {
                    locationDirs.pop();
                } else {
                    locationDirs.push(spec);
                }
            }

            locationDirs.push(fileName);
            return locationDirs.join("/");
        },

        findMediaTypeByHref: function (href) {
            for (var key in this.opf.manifest) {
                var item = this.opf.manifest[key];
                if (item["href"] === href) {
                    return item["media-type"];
                }
            }

            // Best guess if it's not in the manifest. (Those bastards.)
            var match = href.match(/\.(\w+)$/);
            return match && "image/" + match[1];
        },

        saveChapter: function(num) {

            var progress = (num / this.opf.spine.length) * 100;

            var key = this.opf.spine[num];
            var self = this;

            if (this.opf.manifest.hasOwnProperty(key)){
                var mediaType = this.opf.manifest[key]["media-type"];
                var href = this.opf.manifest[key]["href"];

                //TODO read data from this file

                var file = _.find(this.entries, function(entry){
                    return entry.filename == href;
                });

                file.getData(new zip.TextWriter('UTF-8'), function(result) {
                    if (mediaType === "application/xhtml+xml") {
                        //dont post process now
                        self.postProcessHTML(result, href).done(function(html){
                            //console.log('html for chapter '+num);
                            asyncStorage.setItem('book_'+self.bookId+'_chapters_'+num, html);
                            if(num+1 < self.opf.spine.length) {

                                self.ret.notify({'progress':progress, 'bookId': self.bookId});
//                                setTimeout(function(){
                                    self.saveChapter(num+1);
//                                }, 400);


                            } else {
                                window.loading = false;
                                self.ret.resolve(self.bookId);
                                self.ret = null;
                            }

                        });

                    } else {
                        if(num+1 < self.opf.spine.length) {
                            self.ret.notify({'progress':progress, 'bookId': self.bookId});
                            self.saveChapter(num+1);
                        } else {
                            window.loading = false;
                            self.ret.resolve(self.bookId);
                            self.ret = null;
                        }
                    }
                });


            }
        },
        // Will modify all HTML and CSS files in place.
        postProcess: function () {
            window.loading = true;
            this.ret = _.Deferred();
            this.saveChapter(0);

            return this.ret;
        },


        getCoverImage: function(path, contentType){
            var ret = _.Deferred();

            var mime = _.find(this.entries, function(entry){
                return entry.filename == path;
            });

            mime.getData(new zip.Data64URIWriter(contentType), function(text) {
                ret.resolve(text);
            });


            return ret;
        },

        postProcessHTML: function (xml, href) {
            var self = this;
            var ret = _.Deferred();

//            xml = decodeURIComponent(escape(xml));
            var doc = self.xmlDocument(xml);
            //TODO find a way to get images
            var images = doc.getElementsByTagName("img");
            if(images.length){
                var setImageUri = function(n){
                    var image = images[n];
                    var src = image.getAttribute("src");
                    if (/^data/.test(src)) {
                        if(n+1 < images.length) {
                            setImageUri(n+1);
                        } else {
                            ret.resolve(doc.querySelector('body').innerHTML);
                        }
                    }else {

                        self.getDataUri(src, href).done(function(dataUri){
                            image.setAttribute("src", dataUri);

                            if(n+1 < images.length) {
//                                setTimeout(function(){
                                    setImageUri(n+1);
//                                }, 300);

                            } else {
                                ret.resolve(doc.querySelector('body').innerHTML);
                            }

                        });
                    }

                };

                setImageUri(0);
            } else {
                ret.resolve(doc.querySelector('body').innerHTML);
            }



            return ret ;
        },

        getDataUri: function (url, href) {
            var dataHref = this.resolvePath(url, href);
            var mediaType = this.findMediaTypeByHref(dataHref);
            var ret = _.Deferred();

//            console.log('getting data uri for ',dataHref);
            var maxImgWidth = screen.availWidth - 20;
            var img = _.find(this.entries, function(entry){
                return entry.filename == dataHref;
            });

            img.getData(new zip.Data64URIWriter(), function(data){
//                console.log('got image data for '+dataHref);
                if(data.length > 2000000) {
                    ret.resolve(data);
                } else {

                    GLOBAL.image.onload = function(){
                        GLOBAL.image.width = GLOBAL.image.naturalWidth;
                        GLOBAL.image.height = GLOBAL.image.naturalHeight;
//                        var canvas = document.createElement('canvas');

                        if(GLOBAL.image.width > maxImgWidth) {
                            GLOBAL.image.height *= maxImgWidth / GLOBAL.image.width;
                            GLOBAL.image.width = maxImgWidth;
                        } else {
                            ret.resolve(data);
                        }
                            //console.log(image.height, image.width);
    //                        var ctx = window.canvas.getContext("2d");
                        GLOBAL.ctx.clearRect(0, 0, GLOBAL.canvas.width, GLOBAL.canvas.height);
                        GLOBAL.canvas.width = GLOBAL.image.width;
                        GLOBAL.canvas.height = GLOBAL.image.height;
                        GLOBAL.ctx.drawImage(GLOBAL.image, 0, 0, GLOBAL.image.width, GLOBAL.image.height);
                        ret.resolve(GLOBAL.canvas.toDataURL(mediaType));
                        img = null;

                    };
                    GLOBAL.image.onerror = function(){
                        ret.resolve(data);
                    };

                    GLOBAL.image.src = data;
                }

            });


            return ret;
        },


        xmlDocument: function (xml) {

            var doc = new DOMParser().parseFromString(xml, "text/xml");

            if (doc.childNodes[1] && doc.childNodes[1].nodeName === "parsererror") {
                throw doc.childNodes[1].childNodes[0].nodeValue;
            }

            return doc;
        }
    }
}(this));