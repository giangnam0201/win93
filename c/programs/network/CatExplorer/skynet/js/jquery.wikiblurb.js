/*
* File: jquery.wikiblurb.js
* Version: 1.0.0
* Description: A simple jQuery plugin to get sections of Wikipedia and other Wikis
* Author: 9bit Studios
* Copyright 2012, 9bit Studios
* http://www.9bitstudios.com
* Free to use and abuse under the MIT license.
* http://www.opensource.org/licenses/mit-license.php
*/







(function ($) {

    $.fn.wikiblurb = function (options) {

        var defaults = $.extend({
	    wikiURL: "http://en.wikipedia.org/",
	    apiPath: 'w',
	    section: 0,
	    page: 'Cat',
	    removeLinks: false,	    
	    type: 'all',
	    customSelector: '',
            filterSelector: '', 
            callback: function(){ }
        }, options);
        
	/******************************
	Private Variables
	*******************************/         

	var object = $(this);
	var settings = $.extend(defaults, options);
	
	/******************************
	Public Methods
	*******************************/         
        
        var methods = {
        	
	    init: function() {
		return this.each(function () {
		    methods.appendHTML();
		    methods.initializeItems();
		});
	    },

	    /******************************
	    Utilities
	    *******************************/			

	    addUnderscores: function(page) {
		if(page.trim().indexOf(' ') !== -1) {
                    page.replace(' ', '_');
                }
                return page;
	    },            
            
	    /******************************
	    Append HTML
	    *******************************/			

	    appendHTML: function() {
		// nothiing to append
	    },

	    /******************************
	    Initialize
	    *******************************/			

	    initializeItems: function() {
                
                var page = methods.addUnderscores(settings.page);
                
		$.ajax({
		    type: "GET",
		    //url: settings.wikiURL + settings.apiPath + "/api.php?action=parse&format=json&prop=text&section="+settings.section+"&page="+settings.page+"&callback=?",
		    url: settings.wikiURL + settings.apiPath + "/api.php?action=parse&format=json&prop=text&page="+settings.page+"&callback=?",
		    contentType: "application/json; charset=utf-8",
		    async: true,
		    dataType: "json",
		    success: function (data, textStatus, jqXHR) {

			try {
			    var markup = data.parse.text["*"];
			    var blurb = $('<div class="nbs-wikiblurb"></div>').html(markup);

			    // remove links?

			    if(settings.removeLinks) {
				blurb.find('a').each(function() { 
				    $(this).replaceWith($(this).html()); 
				});
			    }
			    else {
				blurb.find('a').each(function() {
				    var link = $(this);
				   // console.log($(this));

				    //link.replace('https://en.wikipedia.org/wiki/','');
				    //link = "www.php?site="+link;

				    var relativePath = link.attr('href').substring(6); // remove leading slash
				    //link.attr('href', settings.wikiURL + relativePath); 

				    var tmp = relativePath;
				    
				    //console.log(tmp);

				    //"www.php?site="

				    link.attr('href', "www.php?site=" + relativePath +"&lang="+lg); 
				});			    
			    }

			    // remove any references
			    blurb.find('sup').remove();

			    // remove cite error
			    blurb.find('.mw-ext-cite-error').remove();

				// filter elements
                            if(settings.filterSelector) { 
                              //  blurb.find(settings.filterSelector).remove(); 
                            }

			    switch(settings.type) {
				case 'text':				
				    object.html($(blurb).find('p'));
				    break;
				    
				case 'blurb':
				    object.html($(blurb).find('p:first'));
				    break;
				
				case 'infobox':
				    object.html($(blurb).find('.infobox'));
				    break;
				    
				case 'custom':
				    object.html($(blurb).find(settings.customSelector));
				    break;
				
				default:
				    object.html(blurb);
				    break;
			    }
                            
                            settings.callback();
				
			}
			catch(e){
			    methods.showError();
			}
			
		    },
		    error: function (jqXHR, textStatus, errorThrown) {
			methods.showError();

				
				console.log(jqXHR);
				console.log(textStatus);
				console.log(errorThrown);
				
		    }
		});
	    },
	    
	    showError: function(){
			
	    	
			object.html('<div id="d404"><a href="javascript:history.back()"><h1>404</h1></a></div>');


			jQuery('div#bg').css('background-image','url("img/404.gif")');
			jQuery('div#bg').css('background-color','#000000');
			jQuery('div#d404').css('color','#000000');
			jQuery('div#d404 a').css('text-decoration','none');
			jQuery('html').css('overflow','hidden');
			

			//background-image: url( 'img/404.gif' );

	    }

        };
        
        if (methods[options]) { // $("#element").pluginName('methodName', 'arg1', 'arg2');
            return methods[options].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof options === 'object' || !options) { 	// $("#element").pluginName({ option: 1, option:2 });
            return methods.init.apply(this);  
        } else {
            $.error( 'Method "' +  method + '" does not exist in 	wikiblurb plugin!');
        } 
    };

})(jQuery);