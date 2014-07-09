(function (GLOBAL) {
    var JSEpub = function (blob) {
        this.blob = blob;
        this.entries = null;
    };

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
                }, function(){def.resolve()});
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

                container.getData(new zip.TextWriter(), function(text) {
                    // text contains the entry data as a String
                    self.container = text;
                    self.opfPath = self.getOpfPathFromContainer();

                    var opfFile = _.find(self.entries, function(entry){
                        return entry.filename == self.opfPath
                    });

                    opfFile.getData(new zip.TextWriter(), function(text) {
                        self.opf = self.readOpf(text);
                        ret.resolve();
                    })

                }, function(current, total) {
                    // onprogress callback
                });

            });


            return ret;



        },

        getMimetype: function(){
            var ret = _.Deferred();

            var mime = _.find(this.entries, function(entry){
                return entry.filename == 'mimetype';
            });

            mime.getData(new zip.TextWriter(), function(text) {
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
            this.bookId = hashCode(opf.metadata['dc:identifier']._text)+'';
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

                file.getData(new zip.TextWriter(), function(result) {
                    if (mediaType === "text/css") {
                        //result = this.postProcessCSS(result);
                    } else if (mediaType === "application/xhtml+xml") {
                        //dont post process now

                        self.postProcessHTML(result, href).done(function(html){
                            //console.log('html for chapter '+num);
                            asyncStorage.setItem('book_'+self.bookId+'_chapters_'+num, html);
                            if(num+1 < self.opf.spine.length) {

                                self.ret.notify({'progress':progress, 'bookId': self.bookId});

                                self.saveChapter(num+1);

                            } else {
                                self.ret.resolve(self.bookId);

                            }

                        });

                    }
                });


            }
        },
        // Will modify all HTML and CSS files in place.
        postProcess: function () {

            this.ret = _.Deferred();

//            console.log('post process', this.opf);
//            var unzipper = this.unzipper(this.blob);

//            console.log('spine length', this.opf.spine.length);
            // save chapters to database

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

//            console.log(images.length+' images in this html');
            if(images.length){
                var setImageUri = function(n){
                    var image = images[n];
                    var src = image.getAttribute("src");

//                console.log('image src', src);

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
                                setImageUri(n+1);
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
                var image = new Image();
                image.onload = function(){

                    var canvas = document.createElement('canvas');


//                    console.log('getdataUri image loaded', image.height, image.width);
//                    console.log('max img width', maxImgWidth);

                    if(image.width > maxImgWidth) {
                        image.height *= maxImgWidth / image.width;
                        image.width = maxImgWidth;
                    } else {
                        ret.resolve(data);
                    }
                    //console.log(image.height, image.width);
                    var ctx = canvas.getContext("2d");
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    canvas.width = image.width;
                    canvas.height = image.height;
                    ctx.drawImage(image, 0, 0, image.width, image.height);
                    var smallImageData = canvas.toDataURL(mediaType);

                    canvas = null;
                    ctx = null;
                    image = null;
                    img = null;
                    ret.resolve(smallImageData);
                };

                image.src = data;
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