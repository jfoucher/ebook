var hashCode = function(s){
    return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
}

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


var showFirstPage = function (epub) {
    var coverpageUrl = epub.opf.metadata.meta.content;
    var bookId = hashCode(epub.opf.metadata['dc:identifier']._text)+'';

    //console.log(coverpageUrl, epub.opf.manifest[coverpageUrl].href, epub.files[epub.opf.manifest[coverpageUrl].href]);
    //TODO make image smaller (42px wide)

    var imageData = epub.files[epub.opf.manifest[coverpageUrl].href];
    var smallImageData;
    var coverImage = 'data:image/*;base64,'+base64_encode(imageData);
    //console.log('Original image data', coverImage);
    if(!$('#book-list').length) {
        $('#index').find('.content').prepend('<ul class="table-view" id="book-list"></ul>');

    }
    $('#book-list').show();
    $('.no-books').hide();
    var ret = _.Deferred();
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
            $('#book-list').append('<li class="table-view-cell media" id="'+bookId+'"><a data-title="'+epub.opf.metadata['dc:title']._text+'" class="navigate-right" href="'+bookId+'"><img class="media-object pull-left" src="'+smallImageData+'" width="42"><div class="media-body">'+epub.opf.metadata['dc:title']._text+'<p>'+epub.opf.metadata['dc:creator']._text+'</p></div></a></li>');
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
        //console.log('small image data', smallImageData);

        $('.loading').hide();
        ret.resolve(book);
    };

    image.src = coverImage;

    var num = 0;
    for(var i=0;i<epub.opf.spine.length;i++ ){
        var spine = epub.opf.spine[i];
        var href = epub.opf.manifest[spine]["href"];
        var doc = epub.files[href];

        asyncStorage.setItem('book_'+bookId+'_chapters_'+i, doc.querySelector('body').innerHTML);

        num++;
    }






    return ret;

};


var updateDatabase = function(books, savedBooksIds){
    var sdcard = navigator.getDeviceStorage('sdcard');
    var cursor = sdcard.enumerate();
    $('.loading').show();
    $('#index').find('.no-books').hide();
    cursor.onsuccess = function () {
        var self = this;
        // Once we found a file we check if there is other results
        var file = this.result;
        if(file) {
            var bookPath = file.path + file.name;
        }


        if(file && (file.type == 'application/epub+zip'||file.name.substr(file.name.length - 4) == 'epub') && savedBooksIds.indexOf(bookPath) === -1) {

            //console.log("EPUB File found: ", file);

            Suvato.progress('Processing '+file.path + file.name);
//            console.log('processing ' +file.path + file.name);
            var reader = new FileReader();
            reader.readAsBinaryString(file);
            reader.onload = function(e){

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
                        }, 12000);
//                        console.log('step1 timeout is '+step1);
                    } else if (step === 2) {
                        if(step1){
                            clearTimeout(step1);
                            step1 = null;
                        }

                        //msg = "Uncompressing " + extras;
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
                        }, 8000);
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
                        }, 8000);
//                        console.log('step4 timeout is '+step4);
                    } else if (step === 5) {
                        clearTimeout(step4);
                        //Suvato.success('Processing '+file.path + file.name);
                        msg = "Finishing "+file.name;
                        showFirstPage(epub).done(function(book){
                            savedBooksIds.push(bookPath);
                            books.push(book);
                            book = null;

                            if (!self.done) {
                                self.continue();
                            }
                        })




                    }
                    if(msg) {
                        //console.log(msg);
                    }

                    // Render the "msg" here.
                });

            };

        } else {
            if (!this.done) {
                $('.loading').show();
                this.continue();
            } else {

                $('.loading').hide();
            }

        }
        if (!this.done) {
            $('.loading').show();
        } else {
            asyncStorage.setItem('savedBooksIds', savedBooksIds);
            asyncStorage.setItem('books', books);
            $('.loading').hide();
            if(books.length) {
                Suvato.success('Ebook database update complete');
            } else {
                Suvato.error('You don\'t have any books', 3000);
                $('#index').find('.no-books').show();
                $('#book-list').hide();
            }


        }




    };



    cursor.onerror = function () {
        console.warn("No file found: ", this.error);
        Suvato.error('You don\'t have any books', 3000);
        $('#index').find('.no-books').show();
        $('.loading').hide();
        $('#book-list').hide();

    };
};
