var hashCode = function(s){
    return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
};

function base64_encode(data) {


    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
        ac = 0,
        enc = '',
        tmp_arr = [];

    if (!data) {
        return data;
    }

    do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1 << 16 | o2 << 8 | o3;

        h1 = bits >> 18 & 0x3f;
        h2 = bits >> 12 & 0x3f;
        h3 = bits >> 6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    var r = data.length % 3;

    return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
}

var findBook = function(id){
    var ret = _.Deferred();
    asyncStorage.getItem('books', function(books) {
        //console.log(books);
        if(!books) {
            ret.reject();
        }
        var book = _.find(books, function(item) {

            return item.id == id;
        });

        if(book) {
            ret.resolve(book);
        } else {
            ret.reject();
        }
    });

    return ret;

};

var updateBook = function(id, data) {
    var ret = _.Deferred();
    asyncStorage.getItem('books', function(books) {

        if(!books) {
            books = [];
        }

        _.map(books, function(book) {
            if (book.id == id){
                //console.log('extending', book, data);
                var b = _.extend(book, data);
//                console.log(b);
                return b;
            }
            return book;
        });
        asyncStorage.setItem('books', books, function(){
            ret.resolve()
        });

    });
    return ret;
};

var deleteBook = function(id) {
    var ret = _.Deferred();
    asyncStorage.getItem('books', function(books) {

        if(!books) {
            books = [];
        }

        var newBooks = _.reject(books, function(item){
            return (item.id == id);
        });

//        console.log('new books', newBooks);

        asyncStorage.setItem('books', newBooks, function(){
            ret.resolve();
        });

    });

    return ret;
};

var getCoverPageUrl = function(opf, initialValue, step) {
    var coverpageUrl = initialValue;

//    console.log('trying with '+initialValue, opf.manifest[coverpageUrl]);

    var toTry = ['coverimage', 'cover-image', 'cover'];

    if(typeof toTry[step] != 'undefined' && typeof opf.manifest[coverpageUrl] == 'undefined') {
//        console.log('failed, trying with '+toTry[step]);
        return getCoverPageUrl(opf, toTry[step], step+1);
    }

    if( typeof opf.manifest[coverpageUrl] !== 'undefined'
        && typeof opf.manifest[coverpageUrl].href !== 'undefined'
        && (opf.manifest[coverpageUrl].href.indexOf('.jpg') !== false || opf.manifest[coverpageUrl].href.indexOf('.png') !== false || opf.manifest[coverpageUrl].href.indexOf('.gif') !== false)
        ){
//        console.log('success with '+initialValue, opf.manifest[coverpageUrl].href);
        return coverpageUrl;
    }


//    console.log('failed, returning '+coverpageUrl);
    return coverpageUrl;

};



var showFirstPage = function (epub) {
    console.log('EPUB data', epub);
    if(!$('#book-list').length) {
        $('#index').find('.content').prepend('<ul class="table-view" id="book-list"></ul>');

    }
    $('#book-list').show();
    $('.no-books').hide();
    var num = epub.opf.spine.length;
    var bookId = epub.bookId;



    var ret = _.Deferred();



    try{
        var coverpageUrl = getCoverPageUrl(epub.opf, epub.opf.metadata.meta.content, 0);

        console.log('got cover url '+coverpageUrl);


        //console.log('COVER IMAGE', coverpageUrl, epub.opf.manifest[coverpageUrl].href, epub.files[epub.opf.manifest[coverpageUrl].href]);
        //TODO make image smaller (42px wide)

        var imageData = epub.getCoverImage(epub.opf.manifest[coverpageUrl].href);
        console.log('cover image data', imageData);
        var smallImageData;
        var coverImage = 'data:image/*;base64,'+base64_encode(imageData);



        var image = new Image();
        image.onload = function(){
            //console.log('image loaded', image.height, image.width);
            var canvas = document.getElementById('imageCanvas');
            if(image.width > 84) {
                image.height *= 84 / image.width;
                image.width = 84;
            }
            //console.log(image.height, image.width);
            var ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0, image.width, image.height);
            smallImageData = canvas.toDataURL("image/jpg");

            canvas = null;
            ctx = null;
            if($('#'+bookId).length == 0){
                $('#book-list').append('<li class="table-view-cell media" id="'+bookId+'"><a href="#" class="delete-book"><span class="icon icon-trash"></span></a><a data-title="'+epub.opf.metadata['dc:title']._text+'" class="" href="'+bookId+'"><img class="media-object pull-left" src="'+smallImageData+'" width="42"><div class="media-body">'+epub.opf.metadata['dc:title']._text+'<p>'+epub.opf.metadata['dc:creator']._text+'</p></div></a></li>');
            }
            var book = {
                id: bookId,
                title: epub.opf.metadata['dc:title']._text,
                cover: smallImageData,
                author: epub.opf.metadata['dc:creator']._text,
                chapter: 0,
                num_chapters: num,
                scroll: 0

            };
            console.log('book', book);
            //console.log('small image data', smallImageData);



            ret.resolve(book);
        };

        image.src = coverImage;


    } catch(e){
        var book = {
            id: bookId,
            title: epub.opf.metadata['dc:title']._text,
            cover: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
            author: epub.opf.metadata['dc:creator']._text,
            chapter: 0,
            num_chapters: num,
            scroll: 0
        };
        console.log('failed book', e, book);
        //console.log('small image data', smallImageData);


        ret.resolve(book);
//        console.log(e);
    }


    return ret;

};




var updateDatabase = function(books, savedBooksIds){
    var ret = _.Deferred();
    if(typeof navigator.getDeviceStorage === 'undefined') {
        ret.reject();
        return;
    }
    var sdcard = navigator.getDeviceStorage('sdcard');
    var cursor = sdcard.enumerate();
    $('#index').find('.loading').show();
    $('#index').find('.no-books').hide();
    cursor.onsuccess = function () {
        var self = this;
        // Once we found a file we check if there is other results
        var file = this.result;
        if(file) {
            var bookPath = file.path + file.name;
        }

        console.log('got file', file);
//        console.log(savedBooksIds, bookPath, savedBooksIds.indexOf(bookPath));

        if(file && (file.type == 'application/epub+zip'||file.name.substr(file.name.length - 4) == 'epub') && file.name.substr(1) !== '.' && savedBooksIds.indexOf(bookPath) === -1) {


            Suvato.progress('Processing '+file.path + file.name);
            console.log('processing ' +file.path + file.name);
            var reader = new FileReader();
            reader.readAsBinaryString(file);
            reader.onload = function(e){

                console.log('read file ', e);


                var epub = new JSEpub(e.target.result);

                var step1, step2, step3, step4;
                epub.processInSteps(function (step, extras) {

                    var msg;
                    if (step === 1) {
                        msg = "Unzipping "+file.name;
                        step1 = setTimeout(function(){
                            Suvato.error('Could not unzip '+file.name);
                            if (!self.done) {
                                self.continue();
                            }
                        }, 120000);
//                        console.log('step1 timeout is '+step1);
                    } else if (step === 2) {
                        if(step1){
                            clearTimeout(step1);
                            step1 = null;
                        }

                    } else if (step === 3) {
                        msg = "Reading OPF for " +file.name;

                        if(step1){
                            clearTimeout(step1);
                            step1 = null;
                        }

                        step3 = setTimeout(function(){
                            Suvato.error('Could not read metadata for '+file.name);
//                            console.log(self.done);
                            if (!self.done) {
//                                console.log('continuing');
//                                console.log(self.result);
                                self.continue();
                            }
                        }, 600000);
//                        console.log('step3 timeout is '+step3);


                    } else if (step === 4) {
//                        console.log('clearing timeout '+step3);
                        if(step3){
                            clearTimeout(step3);
                            step3 = null;
                        }
                        msg = "Post processing "+file.name;
                        step4 = setTimeout(function(){
                            Suvato.error('Could not post process '+file.name);
                            if (!self.done) {
                                self.continue();
                            }
                        }, 600000);
                        console.log('Got opf data, can display book ', epub.opf);

                        showFirstPage(epub).done(function(book){
                            book.path = bookPath;
                            savedBooksIds.push(bookPath);
                            books.push(book);

                            $('#'+book.id).append('<div class="book-loader start"></div>');

                            savedBooksIds = _.uniq(savedBooksIds);
                            books = _.uniq(books, function(item){
                                return item.path;
                            });
                            asyncStorage.setItem('savedBooksIds', savedBooksIds);
                            asyncStorage.setItem('books', books);
                            book = null;
                            $('#index').find('.loading').hide();

                        });


                    } else if (step === 5) {
                        clearTimeout(step4);
                        Suvato.success(file.path + file.name+' is ready');
                        msg = "Finishing "+file.name;

                        if (!self.done) {
                            self.continue();
                        }
                        var b = $('#'+epub.bookId);
//                        })
                        b.find('a[data-title]').addClass('navigate-right');
                        b.find('.book-loader').css({'transform': 'translate3d(0, 0, 0)'}).addClass('removing').on('transitionend', function(){
                            $(this).remove();
                        });


                    } else if(step === 6) {
                        clearTimeout(step4);
                        console.log('progress', extras);
                        var p = 95 - extras.progress;
                        $('#'+extras.bookId).find('.book-loader').css({'transform': 'translate3d(-'+p+'%, 0, 0)'});

                    } else if(step === -1) {
                        Suvato.error(file.path + file.name+' could not be added');
                        if (!self.done) {
                            self.continue();
                        }
                    }

                    if(msg) {
                        console.log(msg);
                    }

                    // Render the "msg" here.
                });

            };

        } else {
            if (!this.done) {
                $('#index').find('.loading').show();
                this.continue();
            } else {
                ret.resolve();
                $('#index').find('.loading').hide();
            }

        }
        if (!this.done) {
            $('#index').find('.loading').show();
        } else {
            asyncStorage.setItem('savedBooksIds', savedBooksIds);
            asyncStorage.setItem('books', books);
            $('#index').find('.loading').hide();

            if(books.length) {
                ret.resolve();
                Suvato.success('Ebook database update complete');
            } else {
                ret.reject();
                Suvato.error('You don\'t have any books', 3000);
                $('#index').find('.no-books').show();
                $('#book-list').hide();
            }


        }




    };



    cursor.onerror = function () {
//        console.warn("No file found: ", this.error);
        Suvato.error('You don\'t have any books', 3000);
        $('#index').find('.no-books').show();
        $('#index').find('.loading').hide();
        $('#book-list').hide();
        ret.reject();
    };
    return ret;
};
