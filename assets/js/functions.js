var hashCode = function(s){
    return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
};

var base64encode = function (input) {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;


    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
            keyStr.charAt(enc1) + keyStr.charAt(enc2) +
            keyStr.charAt(enc3) + keyStr.charAt(enc4);

    }

    return output;
};

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
        console.log('success with '+initialValue, opf.manifest[coverpageUrl]);
        return coverpageUrl;
    }


//    console.log('failed, returning '+coverpageUrl);
    return coverpageUrl;

};



var showFirstPage = function (epub) {
    if(!$('#book-list').length) {
        $('#index').find('.content').prepend('<ul class="table-view" id="book-list"></ul>');
    }
    $('#book-list').show();
    $('.no-books').hide();

    var num = epub.opf.spine.length;
    var bookId = epub.bookId;
    console.log('EPUB', epub);
    var ret = _.Deferred();
    var coverpageUrl = getCoverPageUrl(epub.opf, epub.opf.metadata.meta.content, 0);

    var book = {
        id: bookId,
        title: epub.opf.metadata['dc:title']._text,
        author: epub.opf.metadata['dc:creator']._text,
        chapter: 0,
        cover:'data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        num_chapters: num,
        scroll: 0

    };
//            canvas = null;
//            ctx = null;
    console.log('book', book);
    //console.log('small image data', smallImageData);
    if($('#'+bookId).length == 0){
        console.log('adding line');
        $('#book-list').append('<li class="table-view-cell media" id="'+bookId+'"><a href="#" class="delete-book"><span class="icon icon-trash"></span></a><a data-title="'+book.title+'" class="" href="'+bookId+'"><img class="media-object pull-left" src="'+book.cover+'" width="42"><div class="media-body">'+book.title+'<p>'+book.author+'</p></div></a></li>');
    }

//    ret.resolve(book);


    epub.getCoverImage(epub.opf.manifest[coverpageUrl].href).done(function(imageData){

        console.log('image data length', imageData.length);
        var imgSrc;
        if(imageData.length < 2000000) {
            var image = new Image();
            imgSrc = 'data:'+epub.opf.manifest[coverpageUrl]['media-type']+';base64,'+btoa(imageData);
            console.log('image data', imgSrc);
            image.src = imgSrc;
            image.onload = function(){

                console.log('image loaded', image.height, image.width);
                var canvas = document.getElementById('imageCanvas');


                var ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if(image.width > 84) {
                    image.height *= 84 / image.width;
                    image.width = 84;
                }

                canvas.width = image.width;
                canvas.height = image.height;

                ctx.drawImage(image, 0, 0, image.width, image.height);

                book.cover = canvas.toDataURL("image/jpg");
                ret.resolve(book);
                $('#'+bookId).find('img.media-object').attr('src', book.cover);

            };

        } else {
//            imgSrc = 'data:'+epub.opf.manifest[coverpageUrl]['media-type']+';base64,'+btoa(imageData);
//            book.cover = imgSrc;
//            $('#'+bookId).find('img.media-object').attr('src', imgSrc);
            ret.resolve(book);
        }




    }).fail(function(){
        ret.resolve(book);
    });




//
//    } catch(e){
//        var book = {
//            id: bookId,
//            title: epub.opf.metadata['dc:title']._text,
//            cover: coverImage,
//            author: epub.opf.metadata['dc:creator']._text,
//            chapter: 0,
//            num_chapters: num,
//            scroll: 0
//        };
//
//        console.log('failed book', book);
        //console.log('small image data', smallImageData);


//        ret.resolve(book);
//        console.log(e);
//    }

    return ret;

};


var getFilesToUpdate = function(){
    var ret = _.Deferred();
    if(typeof navigator.getDeviceStorage === 'undefined') {
        ret.reject();
        return ret;
    }

    asyncStorage.getItem('savedBooksIds', function(result){
        if(!result) {
            result = [];
        }
        console.log('saved books ids', result);
        var sdcard = navigator.getDeviceStorage('sdcard');
        var cursor = sdcard.enumerate();
        var files = [];
        cursor.onsuccess = function () {
            var file = this.result;
            //TODO get only new files
            if(file && (file.type == 'application/epub+zip' || file.name.substr(file.name.length - 4) == 'epub') && file.name.substr(0, 1) !== '.' && result.indexOf(file.name) === -1){
                files.push(file);

            }
            if (!this.done) {
                this.continue();
            } else {

                ret.resolve(files);
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
    });


    return ret;
};

var createBookFromFile = function(file) {
    $('#index').find('.loading').show();
    var ret = _.Deferred();
    var bookPath = file.path + file.name;
    var reader = new FileReader();
    reader.readAsBinaryString(file);
    reader.onload = function(e){

        var epub = new JSEpub(e.target.result);



        var step1, step3, step4;
        var displayed;
        epub.processInSteps(function (step, extras) {

            var msg;

            if (step === 1) {
                console.log(file);
                msg = "Unzipping "+file.name;
                step1 = setTimeout(function(){
                    Suvato.error('Could not unzip '+file.name);
                    ret.reject();
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
                    ret.reject();
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
                    ret.reject();
                }, 600000);
                console.log('Got opf data, can display book ', extras);
                displayed = showFirstPage(epub);
                var r = _.Deferred();
                displayed.done(function(book){
                    book.path = bookPath;

                    $('#'+book.id).append('<div class="book-loader start"></div>');

                    asyncStorage.getItem('savedBooksIds', function(result) {
                        if(!result) {
                            result = [];
                        }
                        asyncStorage.setItem('savedBooksIds', _.uniq([book.path].concat(result)));
                    });
                    asyncStorage.getItem('books', function(result){
                        if(!result) {
                            result = [];
                        }
                        asyncStorage.setItem('books', _.uniq([book].concat(result)), function(a){
                            r.resolve();
                            var b = $('#'+epub.bookId);
                            $('#index').find('.loading').hide();
                            b.find('a[data-title]').addClass('navigate-right');
                            var bl = b.find('.book-loader');
                            bl.css({'transform': 'translate3d(0, 0, 0)'})
                                .on('transitionend', function(){
                                    bl.off('transitionend');
                                    setTimeout(function(){
                                        bl.addClass('removing').on('transitionend', function(){
                                            bl.remove();
                                        });
                                    }, 200);

                                });
                        })
                    });

                });
                return r;


            } else if (step === 5) {
                clearTimeout(step4);
//                Suvato.success(file.path + file.name+' is ready');
                msg = "Finishing "+file.name;
                ret.resolve();


            } else if(step === 6) {
                clearTimeout(step4);
                console.log('progress', extras);
                var p = (100 - extras.progress) * .95;
                $('#'+extras.bookId).find('.book-loader').css({'transform': 'translate3d(-'+p+'%, 0, 0)'});

            } else if(step === -1) {
                Suvato.error(file.path + file.name+' could not be added');
                ret.reject();
            }

            if(msg) {
                console.log(msg);
            }

            // Render the "msg" here.
        });

    };

    return ret;
};



var updateDatabase = function(books){

    $('#index').find('.loading').show();
    $('#index').find('.no-books').hide();
    var ret = _.Deferred();
    getFilesToUpdate().done(function(files){
        var books = [];
        var booksIds = [];
        var createNextBook = function(files, num){
            $('#index').find('.loading').show();
            createBookFromFile(files[num]).always(function(){

                if(num + 1 < files.length) {

                    createNextBook(files, num+1);

                } else {

                    $('#index').find('.loading').hide();

                }
            });


        };

        createNextBook(files, 0);

    });

    return ret;


};
