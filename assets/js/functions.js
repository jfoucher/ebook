var hashCode = function(s){
    return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
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
//        console.log('success with '+initialValue, opf.manifest[coverpageUrl]);
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
//    console.log('book', book);
    //console.log('small image data', smallImageData);
    if($('#'+bookId).length == 0){
//        console.log('adding line');
        $('#book-list').append('<li class="table-view-cell media" id="'+bookId+'"><a href="#" class="delete-book"><span class="icon icon-trash"></span></a><a data-title="'+book.title+'" class="" href="'+bookId+'"><img class="media-object pull-left" src="'+book.cover+'" width="42"><div class="media-body">'+book.title+'<p>'+book.author+'</p></div></a></li>');
    }

    return book;
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
//        console.log('saved books ids', result);
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


var getBookCover = function(epub) {
    var ret = _.Deferred();
    var bookId = epub.bookId;
    var coverpageUrl = getCoverPageUrl(epub.opf, epub.opf.metadata.meta.content, 0);
    epub.getCoverImage(epub.opf.manifest[coverpageUrl].href, epub.opf.manifest[coverpageUrl]['media-type']).done(function(imageData){
//        console.log(imageData);
//        console.log('image data length', imageData.length);

        if(imageData.length < 2000000) {
            var image = new Image();

            image.onload = function(){

//                console.log('image loaded', image.height, image.width);

                var canvas = document.createElement('canvas');

                var ctx = canvas.getContext("2d");

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if(image.width > 84) {
                    image.height *= 84 / image.width;
                    image.width = 84;
                }

                canvas.width = image.width;
                canvas.height = image.height;

                ctx.drawImage(image, 0, 0, image.width, image.height);

                var cover = canvas.toDataURL(epub.opf.manifest[coverpageUrl]['media-type']);
                ret.resolve(cover);
                $('#'+bookId).find('img.media-object').attr('src', cover);
                imageData = null;
                ctx = null;
                canvas = null;
                image = null;
            };
            image.src = imageData;

        } else {
            $('#'+bookId).find('img.media-object').attr('src', imageData);
            ret.resolve(imageData);
        }


    }).fail(function(){
        ret.resolve(book);
    });
    return ret;

};


var displayBookLine = function(file) {
    var bookPath = file.path + file.name;
    var epub = new JSEpub(file);
    var ret = _.Deferred();
    epub.getOpf().done(function(){
        var book = showFirstPage(epub);
        book.path = bookPath;
        ret.resolve(epub, book);
    });

    setTimeout(function(){
        ret.resolve();
    }, 5000);

    return ret;

};



var updateDatabase = function(books){

    $('#index').find('.loading').show();
    $('#index').find('.no-books').hide();
    var ret = _.Deferred();
    getFilesToUpdate().done(function(files){

        var linesDefs = [];

        var coverDefs = [];

        var booksDefs = [];

        for(var i = 0; i<files.length;i++) {
            var d = displayBookLine(files[i]);
            linesDefs.push(d);



            d.done(function(epub, book){
                if(!epub){
                    return;
                }
                var gbc = getBookCover(epub);
                var booksSaved = _.Deferred();
                coverDefs.push(booksSaved);

                gbc.done(function(cover){
//                    console.log('got cover', book);

                    $('#'+book.id).append('<div class="book-loader"></div>');

                    asyncStorage.setItem('bookcover-'+book.id, cover, function(){
                        booksSaved.resolve(epub);
                    });

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
                        console.log('got books', result);
                        asyncStorage.setItem('books', _.uniq(books.concat(result)));
                    });

                });
            })
        }


        _.when(linesDefs).done(function(){
            $('#index').find('.loading').hide();

            console.log('libeDefs done', linesDefs);

            var books = _.map(_.reject(linesDefs, function(el){ return typeof el === 'undefined'}), function(item) {
                return item[1];
            });
            var booksPath = _.map(_.reject(linesDefs, function(el){ return typeof el === 'undefined'}), function(item) {
                return item[1].path;
            });

            console.log(books);

            asyncStorage.getItem('books', function(result){
                if(!result) {
                    result = [];
                }
                console.log('got books', result);
                asyncStorage.setItem('books', _.uniq(books.concat(result)));
            });

            asyncStorage.getItem('savedBooksIds', function(result) {
                if(!result) {
                    result = [];
                }
                asyncStorage.setItem('savedBooksIds', _.uniq(booksPath.concat(result)));
            });


            _.when(coverDefs).done(function(){

                console.log('all covers done');
                _.each(coverDefs, function(epub){
                    console.log('def', epub);

                    var p = epub.postProcess();

                    booksDefs.push(p);
                    p.progress(function(data){
                        var prog = (100 - data.progress);
                        $('#'+data.bookId).find('.book-loader').css({'transform': 'translate3d(-'+prog+'%, 0, 0)'});
                    });

                    p.done(function(id){
                        var b = $('#'+id);
                        b.find('a[data-title]').addClass('navigate-right');
                        var bl = b.find('.book-loader');
                        bl.css({'transform': 'translate3d(0, 0, 0)'}).on('transitionend', function(){

                            bl.off('transitionend');
                            setTimeout(function(){
                                bl.addClass('removing').on('transitionend', function(){
                                    bl.remove();
                                });
                            }, 200);

                        });
                    });
                });
                _.when(booksDefs).done(function(){
                    ret.resolve();
                })

            });
        });

    });


    return ret;


};
