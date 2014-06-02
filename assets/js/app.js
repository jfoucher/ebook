





var loadBooks = function(update){


    //TODO get/save to asyncStorage and only update when necessary

    //TODO Make everything async

    //TODO save html by chapters and in separate store


    var getBooks = _.Deferred();
    var getBooksIds = _.Deferred();
    $('.loading').show();
    asyncStorage.getItem('books', function(result) {

        if(!result) {
            result = [];
        }
        getBooks.resolve(result);

    });

    asyncStorage.getItem('savedBooksIds', function(result){
        if(!result) {
            result = [];
        }
        getBooksIds.resolve(result);
    });

    _.when(getBooks, getBooksIds).done(function(books, savedBooksIds){

        //console.log(books);
        if(!$('#book-list').length) {
            $('#index').find('.content').prepend('<ul class="table-view" id="book-list"></ul>');
        }

        if(update || books.length === 0) {
            //$('.loading').hide();
            Suvato.progress('Updating ebook database');
            updateDatabase(books, savedBooksIds);
        } else {
            $('.loading').hide();
//            //console.log(books.length);
            if(books.length) {

                var list = '';
                for(var i=0;i<books.length;i++) {
                    var book = books[i];
                    if($('#'+book.id).length == 0){
                        list += '<li class="table-view-cell media" id="'+book.id+'"><a data-title="'+book.title+'" class="navigate-right" href="'+book.id+'"><img class="media-object pull-left" src="'+book.cover+'" width="42"><div class="media-body">'+book.title+'<p>'+book.author+'</p></div></a></li>';
                    }

                }
                $('#book-list').show().append(list);
                $('.no-books').hide();

            }
        }


    });

//TODO read books from sdcard


};

(function(){
    loadBooks();
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
        if(e.currentTarget.getAttribute('id') == 'next-chapter') {
            add = 1;
        }
        var rb = $('#read-book');

        rb.find('.book-content').html('');
        rb.find('.loading').show();
        rb.find('.chapter').removeClass('hidden');
        var curChapter = parseInt(rb.data('chapter'));
        //console.log('current chapter', curChapter);
        var nextChapter = curChapter + add;
        var numChapters = parseInt(rb.data('numChapters'));

        if(nextChapter <= 0) {
            nextChapter = 0;
            $('#prev-chapter').addClass('hidden');
        }
        if(nextChapter >= numChapters - 1) {
            nextChapter = numChapters - 1
            $('#next-chapter').addClass('hidden');
        }

        //TODO check if we are at the last or first chapter
        asyncStorage.getItem('book_'+rb.data('reading')+'_chapters_'+nextChapter, function(chapter){
            rb.find('.book-content').html(chapter);
            $('.loading').hide();

            rb.data('chapter', nextChapter);

            rb.find('.content').get(0).scrollTop = 0;
        });
        updateBook(rb.data('reading'), {chapter: nextChapter});

    });


    $('.pane').on('click', 'a[data-back]', function(e){

        e.preventDefault();
        $('.panes-wrapper').removeClass('right').addClass('left');
        //Save scroll position for current book
        var rb = $('#read-book');

        var bookId = rb.data('reading');
        var chapter = rb.data('chapter');
        var scrl = rb.find('.content').get(0).scrollTop;
        //console.log('scroll position is ', scrl);
        updateBook(bookId, {scroll: scrl, chapter: chapter});

        rb.find('.book-content').empty();

    });
    var ta = null;
    $('.book-content').on('click', 'a', function(e){
        e.preventDefault();
        //Scroll to element;
        var id = e.currentTarget.getAttribute('href');
        var obj = $(id);
        obj.css({'display': 'inline-block', 'position': 'relative'});
        var childPos = obj.offset();
        var parentPos = obj.parents('.book-content').offset();

        $('#read-book').find('.content').get(0).scrollTop = childPos.top - parentPos.top - 20;

    }).on('touchstart', function(){
        $('#read-book-bar').removeClass('hidden');
        if(ta) clearTimeout(ta);
        ta = setTimeout(function(){
            $('#read-book-bar').addClass('hidden');
        }, 4000);
    });

    $('#index').on('click', 'a.navigate-right', function(e){

        e.preventDefault();
        var rb = $('#read-book');
        var target = e.currentTarget;
        var id = target.getAttribute('href');
        rb.find('.title').html(target.getAttribute('data-title'));
        var w = $('.panes-wrapper');
        w.removeClass('left').addClass('right');
        if(rb.find('.loading').length == 0) {
            rb.find('.content').append('<div id="spinner" class="loading" style="display:none"><img src="assets/img/spinner.gif" width="50" height="50" /></div>');
        }
        $('.loading').show();

        rb.data('reading', id);

        findBook(id).done(function(book){
            rb.find('.title').html(book.title);
            rb.data('chapter', book.chapter);
            rb.data('numChapters', book.num_chapters);
            asyncStorage.getItem('book_'+id+'_chapters_'+book.chapter, function(chapter){
                rb.find('.book-content').html(chapter);
                //TODO append button to load next chapter
                //TODO recover position and load current chapter
                $('.loading').hide();
                rb.find('.chapter').removeClass('hidden');
                if(book.chapter == 0) {
                    $('#prev-chapter').addClass('hidden');
                }

                rb.find('.content').get(0).scrollTop = book.scroll;
            });
        }).fail(function(){
            w.removeClass('right').addClass('left');
            $('.loading').hide();
        });
    });

    $('#add-book').on('click', 'a.new-book.check-right', function(e){
        e.preventDefault();
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
                var percentComplete = (1-(e.loaded / e.total)) * 95;
                ////console.log('progress', percentComplete);
                var val = 'translate3d(-'+percentComplete+'%, 0, 0)';
                $e.find('.book-loader').css({'transform': val});
                // ...
            }
        }, false);

        xhr.addEventListener("load", function(e) {
//            $e.css({background: '#fff'});
            $e.find('.book-loader').on('transitionend', function(){
                $e.find('.book-loader').addClass('removing').off('transitionend');

                $e.find('.book-loader.removing').on('transitionend', function(){
                    $(this).remove();
                });

            });


            if (e.target.status == 200) {
                var contentType = e.target.getResponseHeader('content-type');
                var contentDisposition = e.target.getResponseHeader('content-disposition');

                var blob = new Blob([e.target.response], { type: contentType });
                var a = contentDisposition.substr(contentDisposition.indexOf('"')+1);
                var fname = 'ebooks/'+a.substring(0, a.length - 1);


                var sdcard = navigator.getDeviceStorage("sdcard");
//                var request = sdcard.addNamed(blob, fname);
                var request = sdcard.addNamed(blob, fname);

                //console.log(blob);

                request.onsuccess = function () {
                    var name = this.result;
                    //console.log('File "' + name + '" successfully wrote on the sdcard storage area');
                    $e.removeClass('navigate-right').addClass('check-right');


                    if(blob && (blob.type == 'application/epub+zip'|| fname.substr(fname.length - 4) == 'epub')) {
                        var reader = new FileReader();
                        reader.readAsBinaryString(blob);
                        reader.onload = function(e){

                            var epub = new JSEpub(e.target.result);

                            epub.processInSteps(function (step) {

                                if (step === 5) {
                                    showFirstPage(epub).done(function(book) {
                                        asyncStorage.getItem('books', function(books) {

                                            if(!books) {
                                                books = [];
                                            }
                                            books.push(book);
                                            //console.log(book, books);

                                            asyncStorage.setItem('books', books, function(){
                                                //console.log(book.title + ' was added to your library');
                                                Suvato.success(book.title + ' was added to your library');
                                                book = null;
                                            });


                                        });

                                        asyncStorage.getItem('savedBooksIds', function(savedBooksIds){
                                            if(!savedBooksIds) {
                                                savedBooksIds = [];
                                            }
                                            savedBooksIds.push(fname);
                                            asyncStorage.setItem('savedBooksIds', savedBooksIds);
                                        });
                                    });

                                }
                            });

                        };

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
            console.error('error', e);
        }, false);

        xhr.addEventListener("abort", function(e){
            Suvato.error('Download aborted', 5000);
            console.error('error', e);
        }, false);


        xhr.send();



    });

    window.addEventListener("beforeunload", function( event ) {
        //Save scroll position for current book
        event.preventDefault();
        var rb = $('#read-book');
        var bookId = rb.data('reading');
        var scrl = rb.find('.content').get(0).scrollTop;
//        //console.log('scroll position is ', scrl);
        updateBook(bookId, {scroll: scrl}).done(function(){
            window.close();
        })
    });

    asyncStorage.getItem('books', function(books) {
        navigator.mozL10n.ready( function() {

            //console.log(navigator.mozL10n.language.code);
            var lang = navigator.mozL10n.language.code.substr(0,2);
            var url = 'http://www.feedbooks.com/books/top.atom?lang='+lang;
    //    console.log(url);
            OPDS.access(url, function(catalog){
//                console.log(catalog);
                var content = '';
                var def = _.Deferred();
                _.each(catalog.links, function(link){
                //console.log('link', link);
                    if (link.title){
                        //                console.log(link.navigate);
                        link.navigate(function(feed){
                            //                    content += '<li class="table-view-divider">'+feed.title+'</li>';

                            _.each(feed.entries, function(entry){
                                var bookExists = _.find(books, function(b){
                                    return b.title == entry.title;
                                });
                                var cl = 'navigate-right';
                                if(bookExists){
                                    cl = 'check-right';
                                }

    //                        console.log('entry', entry.title, entry);
                                var epubLink = _.find(entry.links, function(link){
                                    return link.rel == 'http://opds-spec.org/acquisition' && link.type == 'application/epub+zip';
                                });
                                if(epubLink) {
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
    });

    $('#find-books').on('submit', function(e){
        e.preventDefault();
        //console.log(e.currentTarget);
        var search = $('#search').val();
        var lang = navigator.mozL10n.language.code.substr(0,2);
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
                            if(bookExists){
                                cl = 'check-right';
                            }

                            //                        //console.log('entry', entry.title, entry);
                            var epubLink = _.find(entry.links, function(link){
                                return link.rel == 'http://opds-spec.org/acquisition' && link.type == 'application/epub+zip';
                            });
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

    })

})();


