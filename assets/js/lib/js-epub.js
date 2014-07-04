(function (GLOBAL) {
    var JSEpub = function (blob) {
//        this.blob = blob;
        this.unzipper = new JSUnzip(blob);
    };

    GLOBAL.JSEpub = JSEpub;

    JSEpub.prototype = {


        inflate: function(blob) {
            return JSInflate.inflate(blob);
        },

        // None-blocking processing of the EPUB. The notifier callback will
        // get called with a number and a optional info parameter on various
        // steps of the processing:
        //
        //  1: Unzipping
        //  2: Uncompressing file. File name passed as 2nd argument.
        //  3: Reading OPF
        //  4: Post processing
        //  5: Finished!
        //
        // Error codes:
        //  -1: File is not a proper Zip file.
        processInSteps: function (notifier) {
            var self = this;
            notifier(1);
            notifier(2);
            notifier(3);
            var def = _.Deferred();
            console.log('will get opf');

            try{
                self.getOpf().done(function(opf){

//                setTimeout(function(){
                    self.opf = opf;
                    self.getMimetype().done(function(){
                        notifier(4).done(function(){
                            def.resolve();
                        });

                    });
//                }, 150);
                    console.log('Got book opf data');

                });

            } catch(e){
                def.reject();
            }


            //Got OPF data, can display book
            def.done(function(){
                var p = self.postProcess();
                p.progress(function(extras){
                    notifier(6, extras);
                });
                p.done(function(){
                    notifier(5);
                    self.ret = null;
                });
            }).fail(function(){
                notifier(-1);
            });


//            this.unzipBlob(notifier).done(function(){
//                self.uncompressNextCompressedFile(notifier);
//            });



            // When all files are decompressed, uncompressNextCompressedFile
            // will continue with the next step.
        },

        unzipBlob: function (notifier) {
//            var ret = _.Deferred();
//            var unzipper = this.unzipper(this.blob);
//            if (!unzipper.isZipFile()) {
//                notifier(-1);
//                ret.reject();
//            }
//
//            var self = this;
//
//            unzipper.readEntries().done(function(entries){
//                console.log('zip file read', entries);
//                self.files = entries;
//                ret.resolve();
//            });
//
//            return ret;
        },

        uncompressNextCompressedFile: function (notifier) {
            var self = this;

            var ind = this.files.shift();
            console.log('getting data for', ind);
            if(ind) {
                asyncStorage.getItem(ind, function(fileData){
//                    console.log('compressed file', fileData);
                    if (fileData) {
                        notifier(2, ind);
                        if (ind === "META-INF/container.xml") {
                            self.container = fileData;
                        } else if (ind === "mimetype") {
                            self.mimetype = fileData;
                        }

                        self.uncompressNextCompressedFile(notifier);
                        fileData = null;
                    } else {
                        self.didUncompressAllFiles(notifier);

                    }
                });
            }else {
                self.didUncompressAllFiles(notifier);
            }



        },


        didUncompressAllFiles: function (notifier) {
            console.log("did uncompress all files");
            notifier(3);
            this.opfPath = this.getOpfPathFromContainer();
            var self = this;
            asyncStorage.getItem(this.opfPath, function(data){

                self.readOpf(data);
                notifier(4);
                self.postProcess();
                notifier(5);
            });
//            this.readOpf(this.files[this.opfPath]);


        },

        uncompressFile: function (compressedFile) {
            var ret = _.Deferred();
            var data;
            if (compressedFile.compressionMethod === 0) {
                data = compressedFile.data;
            } else if (compressedFile.compressionMethod === 8) {
                data = this.inflate(compressedFile.data);
            } else {
                throw new Error("Unknown compression method "
                                + compressedFile.compressionMethod 
                                + " encountered.");
            }

            if (compressedFile.fileName === "META-INF/container.xml") {
                this.container = data;
            } else if (compressedFile.fileName === "mimetype") {
                this.mimetype = data;
            } else {
                //console.log('uncompressed file', compressedFile.fileName, data);
                asyncStorage.setItem(compressedFile.fileName, data, function(){
                    ret.resolve();
                })
            }

            return ret;
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
            this.unzipper.readPath('META-INF/container.xml').done(function(data) {
                self.container = data;
                console.log('container', self.container);
                self.opfPath = self.getOpfPathFromContainer();
                console.log('opf path', self.opfPath);
                self.unzipper.readPath(self.opfPath).done(function(data) {
                    ret.resolve(self.readOpf(data));
                });


            });

            return ret;



        },

        getMimetype: function(){
            var ret = _.Deferred();
//            var unzipper = this.unzipper(this.blob);
            if (!this.unzipper.isZipFile()) {
                return;
            }
            var self = this;
            this.unzipper.readPath('mimetype').done(function(data){
                self.mimetype = data;
                ret.resolve();
            });

            return ret;

        },

        readOpf: function (xml) {

            xml = decodeURIComponent(escape(xml));
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

        saveChapter: function(num){

            var progress = (num / this.opf.spine.length) * 100;

            var key = this.opf.spine[num];
            var self = this;
            if (this.opf.manifest.hasOwnProperty(key)){
                var mediaType = this.opf.manifest[key]["media-type"];
                var href = this.opf.manifest[key]["href"];

                //TODO read data from this file

                this.unzipper.readPath(href).done(function(result){
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
                                self.ret.resolve();

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

            if (!this.unzipper.isZipFile()) {
                //console.error('not a zip file');
                this.ret.reject();
            }
//            console.log('spine length', this.opf.spine.length);
            // save chapters to database

            this.saveChapter(0);

            return this.ret;
        },


        getCoverImage: function(path){
            console.log(path);
//            var unzipper = this.unzipper(this.blob);
            return this.unzipper.readPath(path);
        },

        postProcessCSS: function (href) {
            var ret = _.Deferred();
            var self = this;

            asyncStorage.getItem(href, function(file, hr){
                file = file.replace(/url\((.*?)\)/gi, function (str, url) {
                    //return str;
                    if (/^data/i.test(url)) {
                        // Don't replace data strings
                        return str;
                    } else {
                        var dataUri = self.getDataUri(url, hr);
                        return "url(" + dataUri + ")";
                    }
                });
                asyncStorage.setItem(hr, file, function(){
                    ret.resolve(file);
                });

            });



            return ret;
        },

        postProcessHTML: function (xml, href) {
            var self = this;
            var ret = _.Deferred();

            xml = decodeURIComponent(escape(xml));
            var doc = self.xmlDocument(xml);
            //TODO find a way to get images
            var images = []; //doc.getElementsByTagName("img");

            //console.log(doc.getElementsByTagName("img").length+' images in this html');
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

                        //Save to asyncstorage



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

            this.unzipper.readPath(dataHref).done(function(data){
                console.log('got image data for '+dataHref);
                var image = new Image();
                image.onload = function(){
                    console.log('getdataUri image loaded', image.height, image.width);
                    var canvas = document.getElementById('imageCanvas');
                    if(image.width > 480) {
                        image.height *= 480 / image.width;
                        image.width = 480;
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

                    ret.resolve(smallImageData);
                };

                image.src = "data:" + mediaType + ";base64," + btoa(data);
            });


            return ret;
        },

        validate: function () {
            if (this.container === undefined) {
                throw new Error("META-INF/container.xml file not found.");
            }

            if (this.mimetype === undefined) {
                throw new Error("Mimetype file not found.");
            }

            if (this.mimetype !== "application/epub+zip") {
                throw new Error("Incorrect mimetype " + this.mimetype);
            }
        },

        // for data URIs
        escapeData: function (data) {
            return escape(data);
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