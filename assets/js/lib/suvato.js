/**
 * Created by jonathan on 20/05/14.
 */

(function(){

    var Suvato = function(){};

    Suvato.prototype.notify = function(type, text, timeout) {
        if(!timeout) {
            timeout = 3000;
        }

        var self = this;

        if($('.pane, .modal').find('.content .notification').length == 0) {
            $('.pane, .modal').find('.content').append('<div class="notification '+type+'">'+text+' </div>');
            $('.notification').addClass('show');

            setTimeout(function(){
                $('.notification').removeClass('show').on('transitionend', function(e){
                    $(this).off('transitionend').remove();
                });

            }, timeout);
        } else {
            $('.notification').on('transitionend', function(e) {
//                $(this).off('transitionend');
                return Suvato.prototype.notify.call(self, type, text);

            });
        }



    };
    Suvato.prototype.error = function(text, timeout) {
        return Suvato.prototype.notify.call(this, 'error', text, timeout);
    };
    Suvato.prototype.warning = function(text, timeout) {
        return Suvato.prototype.notify.call(this, 'warning', text, timeout);
    };
    Suvato.prototype.progress = function(text, timeout) {
        return Suvato.prototype.notify.call(this, 'progress', text, timeout);
    };
    Suvato.prototype.success = function(text, timeout) {
        return Suvato.prototype.notify.call(this, 'success', text, timeout);
    };

    window.Suvato = new Suvato();

})();