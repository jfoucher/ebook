

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
    if(!id) {
        ret.reject();
    }
    asyncStorage.getItem('books', function(books) {

        if(!books) {
            books = [];
        }

        var newBooks = _.reject(books, function(item){
            return (item.id == id);
        });

        console.log('new books', newBooks);

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
        $('#book-list').append('<li class="table-view-cell media" id="'+bookId+'"><a href="#" data-id="'+bookId+'" class="delete-book"><span class="icon icon-trash"></span></a><a data-title="'+book.title+'" class="" href="'+bookId+'"><img class="media-object pull-left" src="'+book.cover+'" width="42"><div class="media-body">'+book.title+'<p>'+book.author+'</p></div></a><div class="book-read-percent" style="transform: translate3d(-100%, 0, 0);"></div></li>');
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
        var sdcard = navigator.getDeviceStorage('sdcard');
        var cursor = sdcard.enumerate();
        var files = [];

        cursor.onsuccess = function () {
            var file = this.result;
            if(file && (file.type == 'application/epub+zip' || file.name.substr(file.name.length - 4) == 'epub') && file.name.split('/').pop().substr(0, 1) !== '.' && result.indexOf(file.name) === -1){
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

    console.log('getting OPF for '+bookPath);

    var epub = new JSEpub(file);
    var ret = _.Deferred();

    epub.getOpf().done(function(){
        var book = showFirstPage(epub);
        book.path = bookPath;
        console.log('got opf', epub);

        ret.resolve(epub, book);
    }).fail(function(){
        console.log('fail opf', epub);

        ret.resolve();
    });

    return ret;

};

var postProcessBook = function(epubs, num){
    var epub = epubs[num];
    var r = _.Deferred();
    var p = epub.postProcess();

    p.progress(function(data){
        var prog = (100 - data.progress);
        $('#'+data.bookId).find('.book-loader').css({'transform': 'translate3d(-'+prog+'%, 0, 0)'});
    });

    p.done(function(id){
        var b = $('#'+id);
        b.find('a[data-title]').addClass('navigate-right');
        var bl = b.find('.book-loader');
        bl.css({'transform': 'translate3d(0, 0, 0)'}).addClass('removing').on('transitionend', function(){
            bl.remove();
        });

        asyncStorage.getItem('books', function(result){
            if(!result) {
                result = [];
            }
            var booksPath = _.map(result, function(item) {
                return item.path;
            });
            asyncStorage.getItem('savedBooksIds', function(result) {
                if(!result) {
                    result = [];
                }
                asyncStorage.setItem('savedBooksIds', _.uniq(booksPath.concat(result)));
            });
            console.log('got books', result);
            asyncStorage.setItem('books', _.uniq([epub.book].concat(result)), function(){
                if(num+1 < epubs.length) {
                    postProcessBook(epubs, num+1);
                } else {
                    r.resolve();
                }
            });
        });
    });
    return r;
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

                console.log('d.done', epub, book);

                if(!epub){
                    return;
                }
                var gbc = getBookCover(epub);
                var booksSaved = _.Deferred();
                coverDefs.push(booksSaved);

                gbc.done(function(cover){
//                    console.log('got cover', book);

                    $('#'+book.id).append('<div class="book-loader"></div>');
                    epub.book = book;
                    asyncStorage.setItem('bookcover-'+book.id, cover, function(){
                        booksSaved.resolve(epub);
                    });

                });
            })
        }

        _.when(linesDefs).done(function(){
            $('#index').find('.loading').hide();

            var books = _.map(_.reject(arguments, function(el){ return typeof el === 'undefined'}), function(item) {
                return item[1];
            });

            console.log('books found', books);

            _.when(coverDefs).done(function(){
                console.log('all covers done', arguments);
                postProcessBook(arguments, 0).done(function(){
                    ret.resolve();
                });

            });
        });

    }).fail(function(){
        ret.reject();
    });


    return ret;


};


var showNewBooks = function(bks){
    document.webL10n.ready( function() {

        var lang = document.webL10n.getLanguage().substr(0,2);
        var url = 'http://www.feedbooks.com/books/top.atom?lang='+lang;
        console.log(url);
        OPDS.access(url, function(catalog){
            console.log(catalog);
            var content = '';

            _.each(catalog.entries, function(entry){
                var bookExists = _.find(bks, function(b){
                    return b.title == entry.title;
                });
                var cl = 'navigate-right';

                var epubLink = _.find(entry.links, function(link){
                    return link.rel == 'http://opds-spec.org/acquisition' && link.type == 'application/epub+zip';
                });
                var lnk = epubLink.url;
                if(bookExists){
                    cl = 'check-right';
                    lnk = bookExists.id;
                }
                if(epubLink) {
                    var thumbnail = _.find(entry.links, function(link){
                        return link.rel == 'http://opds-spec.org/image/thumbnail';
                    });
//                        console.log(thumbnail);
                    content += '<li class="table-view-cell media" id="'+entry.id+'"><a class="'+cl+' new-book" href="'+lnk+'"><img class="media-object pull-left" src="'+thumbnail.url+'" width="42"><div class="media-body">'+entry.title+'<p>'+entry.author.name+'</p></div></a></li>';
                }

            });
            $('#add-book-list').html(content);

            //get Next page link

            var getNextPage = function(catalog){
                var ret = _.Deferred();
//                    console.log('getting next page for', catalog);
                var nextLink = _.find(catalog.links, function(link){
                    return (link.rel == 'next');
                });

                var nextContent = '';
                nextLink.navigate(function(feed){
//                        console.log('feed', feed);

                    _.each(feed.entries, function(entry){
                        var bookExists = _.find(bks, function(b){
                            return b.title == entry.title;
                        });
                        var cl = 'navigate-right';
                        if(bookExists){
                            cl = 'check-right';
                        }

                        var epubLink = _.find(entry.links, function(link){
                            return link.rel == 'http://opds-spec.org/acquisition' && link.type == 'application/epub+zip';
                        });
                        if(epubLink) {
                            var thumbnail = _.find(entry.links, function(link){
                                return link.rel == 'http://opds-spec.org/image/thumbnail';
                            });
//                                console.log(thumbnail);
                            nextContent += '<li class="table-view-cell media" id="'+entry.id+'"><a class="'+cl+' new-book" href="'+epubLink.url+'"><img class="media-object pull-left" src="'+thumbnail.url+'" width="42"><div class="media-body">'+entry.title+'<p>'+entry.author.name+'</p></div></a></li>';
                        }

                    });
                    $('#add-book-list').append(nextContent+'<a href="#" class="btn btn-block next-page">Next</a>');
                    $('#add-book-list').on('click', '.next-page', function(e){
                        e.preventDefault();
                        $('#add-book-list').off('click', '.next-page');
                        $('.next-page').addClass('removing').on('transitionend', function(){
                            $(this).remove();

                        });
                        nextContent = '';
                        getNextPage(feed).done(function(){


                        });
                    });
                    ret.resolve();
                });
                return ret;
            };
            getNextPage(catalog);

        }, new OPDS.Support.MyBrowser());
    });
};



var removeHider = function(){
//    $('#hider').addClass('removing').on('transitionend', function(e){
    $('#hider').remove();
//    });

};



var showBook = function(id) {
    var rb = $('#read-book');
    var ret = _.Deferred();
    var w = $('.panes-wrapper');
    w.removeClass('left').addClass('right');
    rb.find('.content').css({'transform':'translate3d(0,0,0)'});
    if(rb.find('.loading').length == 0) {
        rb.find('.content').append('<div id="spinner" class="loading"><div class="spinner"><div class="mask"><div class="maskedCircle"></div></div></div></div>');
    }
    rb.find('.loading').show();

    rb.data('reading', id);
    $('.currently-reading').removeClass('currently-reading');
    $('#'+id).addClass('currently-reading');


    findBook(id).done(function(book){
//        rb.data('reading-path', book.path);
        rb.find('.title').html(book.title);
        rb.data('chapter', book.chapter);
        rb.data('numChapters', book.num_chapters);
        asyncStorage.getItem('book_'+id+'_chapters_'+book.chapter, function(chapter){

            rb.find('.chapter').removeClass('hidden');
            if(book.chapter == 0) {
                $('#prev-chapter').addClass('hidden');
            }
            rb.find('.book-content').html(chapter);
            rb.find('.loading').hide();
//            updateImagesForChapter(bc, book.chapter, book.path, book.id);
            //TODO append button to load next chapter
            //TODO recover position and load current chapter
            console.log('scroll position', book.scroll);
            rb.find('.content').get(0).scrollTop = book.scroll + 1;
            rb.find('.content').get(0).style.zindex = 9999999;
//            setTimeout(function(){
//                rb.find('.content').css({'transform':'translate3d(0,0,0)'});
//            }, 100)
            ret.resolve();
        });
    }).fail(function(){
        Suvato.error('Could not find this book '+id);
        w.removeClass('right').addClass('left');
        rb.find('.loading').hide();
        ret.reject();
    });
    return ret;
};

var displayBookList = function(books){

    if(books.length > 0){
        for(var i=0;i<books.length;i++) {
            var book = books[i];

            var progress = (1 - (book.chapter / (book.num_chapters-1))) * 100;

            if($('#'+book.id).length == 0){
                $('#book-list').append('<li class="table-view-cell media" id="'+book.id+'"><a href="#" class="delete-book" data-id="'+book.id+'"><span class="icon icon-trash"></span></a><a data-title="'+book.title+'" class="navigate-right" href="'+book.id+'"><img class="media-object pull-left" src="'+book.cover+'" width="42"><div class="media-body">'+book.title+'<p>'+book.author+'</p></div></a><div class="book-read-percent" style="transform: translate3d(-'+progress+'%, 0, 0);"></div></li>');
            }

            asyncStorage.getItem('bookcover-'+book.id, function(cover, k){
                if(cover) {
                    var bookid = parseInt(k.replace('bookcover-', ''));
                    $('#'+bookid).find('img.media-object').attr('src', cover);
                }
            });

        }
        $('#book-list').show();
        $('.no-books').hide();
    } else {
        $('#book-list').hide();
        $('.no-books').show();
        $('#index').find('.loading').hide();
    }


};


var loadBooks = function(update){

    var ret = _.Deferred();

    $('#index').find('.loading').show();
    asyncStorage.getItem('books', function(books) {

        if(!books) {
            books = [];
        }



        if(!$('#book-list').length) {
            $('#index').find('.content').prepend('<ul class="table-view" id="book-list"></ul>');
        }

        if(update || books.length == 0) {
            //$('.loading').hide();
            $('#read-book').find('.book-content').html('');
            Suvato.progress('Updating ebook database');
            $('.bar, .no-books').find('a[data-refresh]').hide();
            updateDatabase(books).always(function(){
                $('.bar, .no-books').find('a[data-refresh]').show();
            }).fail(function(){
                displayBookList(books);
            });
        } else {
            $('#index').find('.loading').hide();
//            //console.log(books.length);
            if(books.length) {
                $('#index').find('.title').text(books.length+ ' eBooks');
                displayBookList(books);
                //addDeleteLinks();
            }
        }
        ret.resolve(books);

    });


    return ret;
};


var createBookFromBlob = function(blob, $e, fname){
    if(blob && (blob.type == 'application/epub+zip'|| fname.substr(fname.length - 4) == 'epub')) {
        var d = displayBookLine(blob);
        d.done(function(epub, book){
            if(!epub){
                return;
            }
            var gbc = getBookCover(epub);

            gbc.done(function(cover){
                $('#'+book.id).append('<div class="book-loader"></div>');
                asyncStorage.setItem('bookcover-'+book.id, cover);
                var p = epub.postProcess();

                p.progress(function(data){
                    var p = 50 - data.progress/2;
                    var p2 = 95 - data.progress;
                    $e.find('.book-loader').css({'transform': 'translate3d(-'+p+'%, 0, 0)'});
                    $('#'+data.bookId).find('.book-loader').css({'transform': 'translate3d(-'+p2+'%, 0, 0)'});
                });

                p.done(function(id){
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
                        asyncStorage.setItem('books', _.uniq([book].concat(result)));
                    });

                    $('#'+id).find('.book-loader').css({'transform': 'translate3d(0, 0, 0)'}).addClass('removing').on('transitionend', function(){
                        $('#'+id).find('a[data-title]').addClass('navigate-right');
                        $(this).remove();
                    });

                    $e.find('.book-loader').css({'transform': 'translate3d(0, 0, 0)'}).addClass('removing').on('transitionend', function(){
                        $e.removeClass('navigate-right').addClass('check-right').attr('href', id);
                        $(this).remove();
                    });
                });

            });
        });
    }
};

var createBookFromClick = function(e){
    e.preventDefault();
    var url = e.currentTarget.getAttribute('href');

    var $e = $(e.currentTarget);
    if($e.hasClass('navigate-right')) {
        $e.prepend('<div class="book-loader"></div>');
    }


    url = url.split("?")[0];
    console.log(window.XMLHttpRequest);

    var xhr = new window.XMLHttpRequest({mozSystem: true});
    console.log(xhr);
    setTimeout(function(){
        $e.find('.book-loader').addClass('start');
    }, 20);

    if(xhr.mozSystem == false) {
        url = 'http://6px.eu/getbook.php?url='+encodeURIComponent(url);
    }

    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.addEventListener("progress", function updateProgress (e) {
        if (e.lengthComputable) {
            var percentComplete = (0.95-(e.loaded / e.total)/1.9) * 100;
            var val = 'translate3d(-'+percentComplete+'%, 0, 0)';
            $e.find('.book-loader').css({'transform': val});
        }
    }, false);

    xhr.addEventListener("load", function() {
        var val = 'translate3d(-50%, 0, 0)';
        $e.find('.book-loader').css({'transform': val});
        if (xhr.status == 200) {
            var contentType = xhr.getResponseHeader('content-type');

            var contentDisposition = xhr.getResponseHeader('Content-Disposition');



            console.log(xhr.getAllResponseHeaders());
            var blob = new Blob([xhr.response], { type: contentType });
            if(contentDisposition) {
                var a = contentDisposition.substr(contentDisposition.indexOf('"')+1);
                var fname = 'ebooks/'+a.substring(0, a.length - 1);
            } else {
                if(xhr.getResponseHeader('X-Filename')) {
                    var fname = 'ebooks/'+xhr.getResponseHeader('X-Filename');
                } else {
                    var fname = 'ebooks/'+'book_'+hashCode(Date.now()+'');
                }

            }

            console.log(fname);


            if(typeof navigator.getDeviceStorage === 'undefined') {
                createBookFromBlob(blob, $e, fname);
            } else {
                var sdcard = navigator.getDeviceStorage("sdcard");
                var request = sdcard.addNamed(blob, fname);
                request.onsuccess = function () {
                    createBookFromBlob(blob, $e, fname);
                };

                request.onerror = function (e) {
                    //console.log(e);
                    if (e.target.error.name =='NoModificationAllowedError'){
                        Suvato.error('This book already exists on your SD card', 5000);
                        $e.removeClass('navigate-right').addClass('check-right');
                    } else {
                        Suvato.error('Could not write book to SD card', 5000);
                    }
                };
            }
        }
    }, false);

    xhr.addEventListener("error", function(e){
        Suvato.error('Could not download this book', 5000);
//            console.error('error', e);
    }, false);

    xhr.addEventListener("abort", function(e){
        Suvato.error('Download aborted', 5000);
//            console.error('error', e);
    }, false);


    xhr.send();


}