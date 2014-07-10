


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
    for(var i=0;i<books.length;i++) {
        var book = books[i];

        var progress = (1 - book.chapter / book.num_chapters) * 100;


        if($('#'+book.id).length == 0){
            $('#book-list').append('<li class="table-view-cell media" id="'+book.id+'"><a data-title="'+book.title+'" class="navigate-right" href="'+book.id+'"><img class="media-object pull-left" src="'+book.cover+'" width="42"><div class="media-body">'+book.title+'<p>'+book.author+'</p></div></a><div class="book-read-percent" style="transform: translate3d(-'+progress+'%, 0, 0);"></div></li>');
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
};


var loadBooks = function(update){

    var ret = _.Deferred();

    $('#index').find('.loading').show();
    asyncStorage.getItem('books', function(books) {

        if(!books) {
            books = [];
        }

        ret.resolve(books);

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

    });


    return ret;
};



var showNewBooks = function(bks){
    document.webL10n.ready( function() {

        var lang = document.webL10n.getLanguage();
        var url = 'http://www.feedbooks.com/books/top.atom?lang='+lang;
        OPDS.access(url, function(catalog){
//                console.log(catalog);
            var content = '';
//                var def = _.Deferred();

            _.each(catalog.entries, function(entry){
                var bookExists = _.find(bks, function(b){
                    return b.title == entry.title;
                });
                var cl = 'navigate-right';


                //                        console.log('entry', entry.title, entry);
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

(function(){
    asyncStorage.getItem('reading', function(reading){
        if(reading) {
            showBook(reading).done(function(){
                removeHider();
                setTimeout(function(){
                    loadBooks().done(function(bks){
                        showNewBooks(bks)
                    });
                }, 5000);

            });

        } else {

            loadBooks().done(function(bks){
                removeHider();
                showNewBooks(bks);
            });

        }

    });

    $('.bar, .no-books').on('click', 'a', function(e){
        e.preventDefault();
        var target = e.currentTarget;
        var l = target.getAttribute('data-target');
        if(l) {
            $('.active').removeClass('active');
            $('#'+l).addClass('active');
        }

    }).on('click', 'a[data-refresh]', function(e){
        e.preventDefault();
        loadBooks(true);

    }).on('click','a.chapter', function(e){
        e.preventDefault();
        var add = -1;
        var rb = $('#read-book');
        rb.find('.book-content').html('');
        rb.find('.loading').show();
        rb.find('.chapter').removeClass('hidden');
        if(e.currentTarget.getAttribute('id') == 'next-chapter') {
            add = 1;
        }


        var curChapter = parseInt(rb.data('chapter'));
        //console.log('current chapter', curChapter);
        var nextChapter = curChapter + add;
        var numChapters = parseInt(rb.data('numChapters'));

        if(nextChapter <= 0) {
            nextChapter = 0;
            $('#prev-chapter').addClass('hidden');
        }
        if(nextChapter >= numChapters - 1) {
            nextChapter = numChapters - 1;
            $('#next-chapter').addClass('hidden');
        }

        //TODO check if we are at the last or first chapter
        asyncStorage.getItem('book_'+rb.data('reading')+'_chapters_'+nextChapter, function(chapter){
            var bc = rb.find('.book-content');
            bc.html(chapter);
            //updateImagesForChapter(bc, nextChapter, rb.data('reading-path'), rb.data('reading'));
            rb.find('.loading').hide();

            rb.data('chapter', nextChapter);

            var progress = (1 - nextChapter/rb.data('num-chapters')) * 100;

            $('#'+rb.data('reading')).find('.book-read-percent').css({'transform': 'translate3d(-'+progress+'%, 0, 0)'});
            rb.find('.content').get(0).scrollTop = 0;
            updateBook(rb.data('reading'), {chapter: nextChapter});
        });


    });


    $('.pane').on('click', 'a[data-back]', function(e){

        e.preventDefault();
        $('.panes-wrapper').removeClass('right').addClass('left');
        //Save scroll position for current book
        var rb = $('#read-book');

        var bookId = rb.data('reading');
        var chapter = rb.data('chapter');
        var scrl = rb.find('.content').get(0).scrollTop;
        $('#read-book-bar').removeClass('hidden');
        //console.log('scroll position is ', scrl);
        asyncStorage.setItem('reading', false);
        rb.find('.book-content').empty();



        updateBook(bookId, {scroll: scrl, chapter: chapter});



    }).on('click', 'a', function(){
        if(ta) clearTimeout(ta);
    });
    var ta = null;
    var timer = null;
    $('.book-content').on('click', 'a', function(e){
        e.preventDefault();
        //Scroll to element;
        var id = e.currentTarget.getAttribute('href');
        var obj = $(id);
        obj.css({'display': 'inline-block', 'position': 'relative'});
        var childPos = obj.offset();
        var parentPos = obj.parents('.book-content').offset();

        $('#read-book').find('.content').get(0).scrollTop = childPos.top - parentPos.top - 20;

    })
        .on('touchstart', function(e){
        //TODO Only if not scrolled to the end

        $('#read-book-bar').removeClass('hidden');
        if(ta) clearTimeout(ta);
        ta = setTimeout(function(){
            $('#read-book-bar').addClass('hidden');
        }, 4000);
    });
    $('#read-book').find('.content').on('scroll', function(e){
        //console.log(e);
        if(timer !== null) {
            clearTimeout(timer);
        }

        timer = setTimeout(function(){
            var $el = $('#read-book').find('.content');
            //console.log($el.get(0).scrollTop, $el.get(0).offsetHeight, $el.find('.book-content').get(0).offsetHeight);
            if($el.get(0).scrollTop + $el.get(0).offsetHeight >= $el.find('.book-content').get(0).offsetHeight-50) {
                if(ta) clearTimeout(ta);
                $('#read-book-bar').removeClass('hidden');
            }

        }, 150);
    });
    var startX;
    var currentPos = 0;
    var prevX = 0;
    $('#index').on('click', 'a[data-title]', function(e){
        e.preventDefault();
    });
    $('#index').on('click', 'a.navigate-right', function(e){

        e.preventDefault();

        var target = e.currentTarget;
        var id = target.getAttribute('href');
        var rb = $('#read-book');
        rb.find('.title').html(target.getAttribute('data-title'));
        showBook(id);
        asyncStorage.setItem('reading', id);

    }).on('touchstart', 'li', function(e){
        var touches = e.changedTouches;
        var $el = $(e.currentTarget);
        startX = touches[0].pageX;
        prevX = touches[0].pageX;
        var lis = $el.find('a');
        lis.css({'transition': ''});

    }).on('touchend', 'li', function(e){
        var $el = $(e.currentTarget);
        var touches = e.changedTouches;
        var moveX = - (currentPos - (touches[0].pageX - startX));
        var lis = $el.find('a');
        lis.css({'transform': '', 'transition': 'transform 0.8s'});
        if(moveX <= 0) {
            $el.removeClass('deleting');
        }else if(moveX >= 70) {

            $el.addClass('deleting');

        } else {
            $el.removeClass('deleting');
        }

    }).on('touchmove', 'li', function(e){
        var $el = $(e.currentTarget);
        var touches = e.changedTouches;

        var moveX = - (currentPos - (touches[0].pageX - startX));
        var lis = $el.find('a');
        if(moveX <= 0) {
            moveX = 0;

        }else if(moveX >= 80) {
            moveX = 80;

        }
        lis.css({'transform': 'translateX('+moveX+'px)'});

        prevX = touches[0].pageX;
    });

    $('#add-book').on('click', 'a.new-book.check-right', function(e){
        e.preventDefault();
        $('.active').removeClass('active');
        $('#index').addClass('active');
        var id = e.currentTarget.getAttribute('href');
        console.log('opening', id);
        showBook(id);

        asyncStorage.setItem('reading', id);
        //TODO close add book modal and read book
    })
        .on('click', 'a.new-book.navigate-right', function(e){
        e.preventDefault();
        var url = e.currentTarget.getAttribute('href');

        var $e = $(e.currentTarget);
        $e.prepend('<div class="book-loader"></div>');

        url = url.split("?")[0];

        var xhr = new window.XMLHttpRequest({mozSystem: true});
        setTimeout(function(){
            $e.find('.book-loader').addClass('start');
        }, 20);

        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.addEventListener("progress", function updateProgress (e) {
            if (e.lengthComputable) {
                var percentComplete = (0.95-(e.loaded / e.total)/1.9) * 100;
                var val = 'translate3d(-'+percentComplete+'%, 0, 0)';
                $e.find('.book-loader').css({'transform': val});
            }
        }, false);

        xhr.addEventListener("load", function(e) {
            var val = 'translate3d(-50%, 0, 0)';
            $e.find('.book-loader').css({'transform': val});
            if (e.target.status == 200) {
                var contentType = e.target.getResponseHeader('content-type');
                var contentDisposition = e.target.getResponseHeader('content-disposition');

                var blob = new Blob([e.target.response], { type: contentType });
                var a = contentDisposition.substr(contentDisposition.indexOf('"')+1);
                var fname = 'ebooks/'+a.substring(0, a.length - 1);
                var sdcard = navigator.getDeviceStorage("sdcard");
//                var request = sdcard.addNamed(blob, fname);
                var request = sdcard.addNamed(blob, fname);
                request.onsuccess = function () {
                    var name = this.result;
                    if(blob && (blob.type == 'application/epub+zip'|| fname.substr(fname.length - 4) == 'epub')) {

                        var bookId;

                        //TODO move to new processing

                        var d = displayBookLine(blob);

                        d.done(function(epub, book){
                            if(!epub){
                                return;
                            }
                            var gbc = getBookCover(epub);

                            gbc.done(function(cover){

                                $('#'+book.id).append('<div class="book-loader"></div>');

                                asyncStorage.setItem('bookcover-'+book.id, cover);

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

                                var p = epub.postProcess();

                                p.progress(function(data){
                                    var p = 50 - data.progress/2;
                                    var p2 = 95 - data.progress;
                                    $e.find('.book-loader').css({'transform': 'translate3d(-'+p+'%, 0, 0)'});
                                    $('#'+data.bookId).find('.book-loader').css({'transform': 'translate3d(-'+p2+'%, 0, 0)'});
                                });

                                p.done(function(id){
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



    });

    document.addEventListener("visibilitychange", function() {
//        console.log( document.visibilityState );
        var rb = $('#read-book');
        if(document.visibilityState == 'hidden'){
            if($('.panes-wrapper').hasClass('right')){

                var bookId = rb.data('reading');
                asyncStorage.setItem('reading', bookId);
                var scrl = rb.find('.content').get(0).scrollTop;
    //        //console.log('scroll position is ', scrl);
                updateBook(bookId, {scroll: scrl});
            }else {
                asyncStorage.setItem('reading', false);
            }
        } else {
            rb.find('.content').css({'transform':'translate3d(0,0,0)'});
        }
    });

    $('#find-books').on('submit', function(e){
        e.preventDefault();
        //console.log(e.currentTarget);
        var search = $('#search').val();
        var lang = document.webL10n.getLanguage().substr(0,2);
        var url = 'http://www.feedbooks.com/search.atom?query='+search+'&lang='+lang;
        var books = [];
        asyncStorage.getItem('books', function(b) {
            books = b;
        });
        OPDS.access(url, function(catalog){
//                console.log(catalog);
            var content = '';
            var booksDone = [];
            _.each(catalog.links, function(link){
                //console.log('link', link);
                if (link.title){
                    //                //console.log(link.navigate);
                    link.navigate(function(feed){
                        //                    content += '<li class="table-view-divider">'+feed.title+'</li>';

                        _.each(feed.entries, function(entry){
                            var bookExists = _.find(books, function(b){
                                return b.title == entry.title;
                            });
                            var cl = 'navigate-right';
                            console.log('book exists', bookExists);

                            //                        //console.log('entry', entry.title, entry);
                            var epubLink = _.find(entry.links, function(link){
                                return link.rel == 'http://opds-spec.org/acquisition' && link.type == 'application/epub+zip';
                            });

                            if(bookExists){

                                cl = 'check-right';
                                epubLink = bookExists.id;
                            }
                            if(epubLink && _.indexOf(booksDone, epubLink.url) == -1) {
                                booksDone.push(epubLink.url);
                                var thumbnail = _.find(entry.links, function(link){
                                    return link.rel == 'http://opds-spec.org/image/thumbnail';
                                });
                                content += '<li class="table-view-cell media" id="'+entry.id+'"><a class="'+cl+' new-book" href="'+epubLink.url+'"><img class="media-object pull-left" src="'+thumbnail.url+'" width="42"><div class="media-body">'+entry.title+'<p>'+entry.author.name+'</p></div></a></li>';
                            }

                        });
                        $('#add-book-list').html(content);
                    });
                }
            });

        });

    });

    $(document).on('click', 'a[href="^http"]', function(e){
        window.open(e.currentTarget.href);
    });

    document.webL10n.ready( function() {
        document.getElementById('search').placeholder = document.webL10n.get('search');
    });

})();


