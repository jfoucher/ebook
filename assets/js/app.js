

(function(){

    asyncStorage.getItem('fontsize', function(s){
        if(s) {
            $('.book-content').css('font-size', s);
        }
    });

    try {
        asyncStorage.getItem('reading', function(reading){
            if(reading) {
                $('#read-book').find('.book-content, .bar').show();
                showBook(reading).done(function(){
                    removeHider();
                    loadBooks().done(function(bks){
                        showNewBooks(bks);
                        $('.currently-reading').removeClass('currently-reading');
                        $('#'+reading).addClass('currently-reading');
                    });
                });
            } else {
                loadBooks().done(function(bks){
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
        var l = e.currentTarget.getAttribute('data-target');
        if(l) {
            $('.active').removeClass('active');
            $('#'+l).addClass('active');
        }

    }).on('click', 'a[data-refresh]', function(e){
        e.preventDefault();
        loadBooks(true);

    }).on('click','a.chapter', function(e){
        e.preventDefault();
        var add = -1, rb = $('#read-book');
        rb.find('.book-content').html('');
        rb.find('.loading').show();
        rb.find('.chapter').removeClass('hidden');
        if(e.currentTarget.getAttribute('id') == 'next-chapter') {
            add = 1;
        }


        var curChapter = parseInt(rb.data('chapter')),
            nextChapter = curChapter + add,
            numChapters = parseInt(rb.data('numChapters'));

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
        var rb = $('#read-book'),
            scrl = rb.find('.content').get(0).scrollTop,
            bookId = rb.data('reading'),
            chapter = rb.data('chapter');
        $('.panes-wrapper').removeClass('right').addClass('left');
        $('#read-book-bar').removeClass('hidden');
        asyncStorage.setItem('reading', false);
        rb.find('.book-content').empty();
        updateBook(bookId, {scroll: scrl, chapter: chapter});
    }).on('click', 'a', function(){
        if(ta) clearTimeout(ta);
    });
    var ta = null,
        dist = 0,
        prevDist = 0,
        startY;
//    var translated = 0;

    $('.book-content').on('click', 'a', function(e){
        e.preventDefault();
        //Scroll to element;
        var id = e.currentTarget.getAttribute('href'),
            obj = $(id),
            childPos = obj.offset(),
            parentPos = obj.parents('.book-content').offset();
        obj.css({'display': 'inline-block', 'position': 'relative'});
        $('#read-book').find('.content').get(0).scrollTop = childPos.top - parentPos.top - 20;

    })
        .on('touchstart', function(e){
            //TODO Only if not scrolled to the end
            startY = e.originalEvent.changedTouches[0].clientY;

            $('#read-book-bar').removeClass('hidden');
            if(ta) clearTimeout(ta);
            ta = setTimeout(function(){
                $('#read-book-bar').addClass('hidden');
            }, 4000);
            var bc = $('.book-content');
            bc.data('font-size', bc.css('font-size').replace('px', ''));
    })
    .on('touchmove', function(e){
            var touches = e.originalEvent.changedTouches;
            if (touches.length == 2){
                dist = Math.sqrt(Math.pow((touches[0].clientX - touches[1].clientX), 2) + Math.pow((touches[0].clientY - touches[1].clientY),2));
                if(prevDist !== 0 && prevDist !== dist){
                    var dif = dist - prevDist,
                        bc = $('.book-content'),
                        fs = parseInt(bc.data('font-size'));
                    if(dif > 0) {
                        dif = dif * 10;
                    }
                    bc.data('font-size', fs + dif/100);
                    bc[0].style.fontSize = Math.round(fs + dif/100) + 'px';
                }
                prevDist = dist;
            }
//            if(touches.length == 1){
//                var $el = $('#read-book').find('.content');
//                var mv = translated + (e.originalEvent.changedTouches[0].clientY - startY) / 3;
////                console.log('mv', mv, 'startY', startY, 'clientY',  e.originalEvent.changedTouches[0].clientY );
////                console.log('scrollTop', $el.get(0).scrollTop);
//                if($el.get(0).scrollTop + $el.get(0).offsetHeight >= $el.find('.book-content').get(0).offsetHeight - 50) {
//                    console.log($el.get(0).scrollTop + $el.get(0).offsetHeight, $el.find('.book-content').get(0).offsetHeight - 50);
//                    if(ta) clearTimeout(ta);
//                    $('#read-book-bar').removeClass('hidden');
//                    // TODO move it up
//                    if(mv < -80) mv = -80;
//                    $el.css('transform','translate3d(0, '+mv+'px, 0)');
//                } else if($el.get(0).scrollTop <= 5){
//                    if(mv > 70) mv = 70;
//                    $el.css('transform', 'translate3d(0, '+mv+'px, 0)');
//                } else {
//                    $el.css('transform', 'none');
//                }
//            }
//            console.log('touches', touches.length);

        }).on('touchend', function(e){
            dist = 0;
            prevDist = 0;
            asyncStorage.setItem('fontsize', $('.book-content').css('font-size'));

//            translated = (e.originalEvent.changedTouches[0].clientY - startY) / 3;
//            if(translated < -80) translated = -80;
//            if(translated > 70) translated = 70;
        });

    var startX,
        currentPos = 0,
        prevX = 0;
    $(document).on('click', 'a.delete-book', function(e){
        e.preventDefault();
        var $el = $(e.currentTarget),
            li = $('#'+$el.data('id'));
        li.addClass('removing');
        deleteBook($el.data('id')).done(function(){
            $('#read-book').find('.book-content, .bar').hide();
            asyncStorage.setItem('reading', false);
            li.remove();

        }).fail(function(){
            li.removeClass('removing');
        });


    });
    $('#index')

        .on('click', 'a[data-title]:not(.navigate-right)', function(e){

            e.preventDefault();

            //TODO if we are postprocessing show modal to say so

            alert(document.webL10n.get('wait-postprocessing', {"title": e.currentTarget.getAttribute('data-title')}));

    }).on('click', 'a.navigate-right', function(e){

        e.preventDefault();

        var target = e.currentTarget,
            id = target.getAttribute('href'),
            rb = $('#read-book');
        rb.find('.title').html(target.getAttribute('data-title'));

        rb.find('.book-content, .bar').show();
        if (rb.data('reading')) {
            var chapter = rb.data('chapter'),
                scrl = rb.find('.content').get(0).scrollTop;
            updateBook(rb.data('reading'), {scroll: scrl, chapter: chapter});
        }


        showBook(id);
        asyncStorage.setItem('reading', id);

    }).on('touchstart', 'li', function(e){
        var touches = e.originalEvent.changedTouches,
            $el = $(e.currentTarget),
            lis = $el.find('a[data-title]');
        startX = touches[0].pageX;
        prevX = touches[0].pageX;
        lis.css({'transition': ''});

    }).on('touchend', 'li', function(e){
        var $el = $(e.currentTarget),
            touches = e.originalEvent.changedTouches,
            moveX = - (currentPos - (touches[0].pageX - startX)),
            lis = $el.find('a[data-title]');
        lis.css({'transform': '', 'transition': 'transform 0.8s'});
        if(moveX <= 0) {
            $el.removeClass('deleting');
        }else if(moveX >= 70) {

            $el.addClass('deleting');

        } else {
            $el.removeClass('deleting');
        }

    }).on('touchmove', 'li', function(e){
        var $el = $(e.currentTarget),
            touches = e.originalEvent.changedTouches,
            moveX = - (currentPos - (touches[0].pageX - startX)),
            lis = $el.find('a[data-title]');
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
        showBook(id);
        asyncStorage.setItem('reading', id);
    })
    .on('click', 'a.new-book.navigate-right', function(e){
        createBookFromClick(e);
    });

    document.addEventListener("visibilitychange", function() {
//        console.log( document.visibilityState );
        var rb = $('#read-book');
        if(document.visibilityState == 'hidden'){
            if($('.panes-wrapper').hasClass('right')){

                var bookId = rb.data('reading'),
                    scrl = rb.find('.content').get(0).scrollTop;
                asyncStorage.setItem('reading', bookId);
    //        //console.log('scroll position is ', scrl);
                updateBook(bookId, {scroll: scrl});
            }else {
                asyncStorage.setItem('reading', false);
            }
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
        OPDS.access(url, function(catalog){
            var booksDone = [];
            if(catalog.links.length == 0){
                $('#add-book').find('.loading').hide();
            }
            _.each(catalog.links, function(link){

                //console.log('link', link);
                if (link.title){
                    //                //console.log(link.navigate);
                    link.navigate(function(feed){
                        //                    content += '<li class="table-view-divider">'+feed.title+'</li>';
                        var content = '';
                        //TODO separate by author

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
                                var categories = [entry.categories[0]];
                                if(typeof entry.categories[2] !== 'undefined') {
                                    categories.push(entry.categories[2]);
                                }
                                if(typeof entry.categories[4] !== 'undefined') {
                                    categories.push(entry.categories[4]);
                                }
                                content += '<li class="table-view-cell media" id="'+entry.id+'"><a class="'+cl+' new-book" href="'+epubLink.url+'"><img class="media-object pull-left" src="'+thumbnail.url+'" width="42"><div class="media-body">'+entry.title+'<p>'+categories.join(',')+'</p></div></a></li>';

                            }

                        });

                        if(content) {
                            $('#add-book').find('.loading').hide();
                            $('#add-book-list').append('<li class="table-view-divider">'+link.title+'</li>'+content);
                        }


                    });
                }
            });

        });

    });

    $(document).on('click', 'a[href*="feedbooks.com"][href$="epub"]', function(e){
        e.preventDefault();
        createBookFromClick(e.currentTarget.getAttribute('href'));
        //TODO load book
    });
    $(document).on('click', 'a[href="^http"]', function(e){
        window.open(e.currentTarget.href);
    });

    document.webL10n.ready( function() {
        document.getElementById('search').placeholder = document.webL10n.get('search');
    });

})();


