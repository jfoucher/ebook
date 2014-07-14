

(function(){


try {
    asyncStorage.getItem('reading', function(reading){
        if(reading) {
            showBook(reading).done(function(){
                removeHider();
                loadBooks().always(function(bks){
                    console.log('books loaded', $('#'+reading));
                    showNewBooks(bks);
                    $('.currently-reading').removeClass('currently-reading');
                    $('#'+reading).addClass('currently-reading');
                });
            });
        } else {
            loadBooks().always(function(bks){
                removeHider();
                showNewBooks(bks);
            });
        }
    });
} catch(e) {
    removeHider();
    showNewBooks([]);
}



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

            var progress = (1 - nextChapter/(rb.data('num-chapters')-1)) * 100;

            $('#'+rb.data('reading')).find('.book-read-percent').css({'transform': 'translate3d(-'+progress+'%, 0, 0)'});
            rb.find('.content').get(0).scrollTop = 0;
            updateBook(rb.data('reading'), {chapter: nextChapter});
        });


    });


    $('.pane').on('click', 'a[data-back]', function(e){

        e.preventDefault();
        var rb = $('#read-book');
        var scrl = rb.find('.content').get(0).scrollTop;
        $('.panes-wrapper').removeClass('right').addClass('left');
        //Save scroll position for current book

        var bookId = rb.data('reading');
        var chapter = rb.data('chapter');
        $('#read-book-bar').removeClass('hidden');
        console.log('scroll position is ', scrl);
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
        .on('touchstart', function(){
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
    $(document).on('click', 'a.delete-book', function(e){
        e.preventDefault();
        var $el = $(e.currentTarget);
        var li = $('#'+$el.data('id'));
        li.addClass('removing');
        deleteBook($el.data('id')).done(function(){
            $('#read-book').find('.book-content, .title').empty();
            asyncStorage.setItem('reading', false);
            li.remove();

        }).fail(function(){
            li.removeClass('removing');
        });


    });
    $('#index')

        .on('click', 'a[data-title]', function(e){
        e.preventDefault();
    }).on('click', 'a.navigate-right', function(e){

        e.preventDefault();

        var target = e.currentTarget;

        var id = target.getAttribute('href');
        var rb = $('#read-book');
        rb.find('.title').html(target.getAttribute('data-title'));


        if (rb.data('reading')) {
            var chapter = rb.data('chapter');
            var scrl = rb.find('.content').get(0).scrollTop;
            console.log('scroll position is ', scrl);
            updateBook(rb.data('reading'), {scroll: scrl, chapter: chapter});
        }


        showBook(id);
        asyncStorage.setItem('reading', id);

    }).on('touchstart', 'li', function(e){
        var touches = e.originalEvent.changedTouches;
        var $el = $(e.currentTarget);
        startX = touches[0].pageX;
        prevX = touches[0].pageX;
        var lis = $el.find('a[data-title]');
        lis.css({'transition': ''});

    }).on('touchend', 'li', function(e){
        var $el = $(e.currentTarget);
        var touches = e.originalEvent.changedTouches;
        var moveX = - (currentPos - (touches[0].pageX - startX));
        var lis = $el.find('a[data-title]');
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
        var touches = e.originalEvent.changedTouches;
        var moveX = - (currentPos - (touches[0].pageX - startX));
        var lis = $el.find('a[data-title]');
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
        createBookFromClick(e);
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

    $('#lang').on('change', function(){
        $('#find-books').submit();
    });

    $('#find-books').on('submit', function(e){
        e.preventDefault();
        //console.log(e.currentTarget);
        var search = $('#search').val();

        $('#add-book-list').empty();
        $('#add-book').find('.loading').show();


        var lang = $('#lang').val();
        if(!lang) {
            lang = document.webL10n.getLanguage().substr(0,2);
        }
        var url = 'http://www.feedbooks.com/search.atom?query='+search+'&lang='+lang;
        if($('#lang').val() == 'all') {
            url = 'http://www.feedbooks.com/search.atom?query='+search;
        }
        var books = [];
        asyncStorage.getItem('books', function(b) {
            books = b;
        });
        console.log(url);
        OPDS.access(url, function(catalog){
            console.log(catalog);

            var booksDone = [];
            _.each(catalog.links, function(link){

                //console.log('link', link);
                if (link.title){
                    //                //console.log(link.navigate);
                    link.navigate(function(feed){
                        //                    content += '<li class="table-view-divider">'+feed.title+'</li>';
                        var content = '';
                        _.each(feed.entries, function(entry){

                            var bookExists = _.find(books, function(b){
                                return b.title == entry.title;
                            });
                            var cl = 'navigate-right';

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
                        console.log(content);
                        if(content) {
                            $('#add-book').find('.loading').hide();
                            $('#add-book-list').append('<li class="table-view-divider">'+link.title+'</li>');
                        }
                        $('#add-book-list').append(content);

                    });
                }
            });

        });

    });

    $(document).on('click', 'a[href*="feedbooks.com"][href$="epub"]', function(e){
        e.preventDefault();
        var url = e.currentTarget.getAttribute('href');
        console.log(url);
        createBookFromClick(e);
        //TODO load book
    });
    $(document).on('click', 'a[href="^http"]', function(e){
        window.open(e.currentTarget.href);
    });

    document.webL10n.ready( function() {
        document.getElementById('search').placeholder = document.webL10n.get('search');
    });

})();


