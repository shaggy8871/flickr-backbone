(function ($) {

	/* 
	 * Flickr list and display
	 * Copyright (C) 2013, John Ginsberg
	 */

	/* 
	 * NS
	 */
	window.flickr = {
		Models: {},
		Collections: {},
		Views: {},
		Router: {}
	};

	/* 
	 * External templates
	 */
	window.template = function (id){
		return _.template($('#' + id).html ());
	};

	flickr.Router = Backbone.Router.extend ({
		routes: {
			'': 'index',
			'show/:id': 'show'
		},
		index: function () {
			$('#photoSingle').hide ();
//			$('#album').show ();
			if (!window.album) {
				window.album = new flickr.Views.Album ({ hidden: true });
				window.album.loadPhotos ();
			}
			if (window.singlePhoto) {
				window.singlePhoto.undelegateEvents (); // remove events, start again
				$('#album').fadeIn ();
			} else {
				$('#album').fadeIn ();
			}
			document.title = 'Potato demo';
		},
		show: function (id) {
			//--- If we start from here, grab the feed first
			if (!window.album) {
				$('#photoSingle').show ();
				$('#album').hide ();
				window.album = new flickr.Views.Album ({ hidden: true });
				window.album.loadPhotos (id); // set the id here so it renders only once downloaded
			} else {
				//--- We already have the feed so let's find the record we want
				try {
					$('#photoSingle').hide ();
					window.singlePhoto = new flickr.Views.PhotoSingle ({
						model: window.album.collection._byId[id]
					});
					document.title = window.album.collection._byId[id].get ('title');
					$('#photoSingle').show ('slide', { direction: 'up' });
					$('#album').hide ();
				} catch (e) {
					$('#photoSingle').hide ();
					$('#album').show ();
					alert ('Could not find that photo. Please choose another.');
				}
			}
		}
	});

	/* 
	 * Photo model, stores basic photo information
	 */
	flickr.Models.Photo = Backbone.Model.extend ({
		idAttribute: "_id",
		defaults: {
			title: 'Unknown photo',
			published: '',
			media: '',
			author_id: '',
			link: '',
			description: '',
			tags: ''
		}
	});

	/* 
	 * Album (photo collection)
	 */
	flickr.Collections.Album = Backbone.Collection.extend ({
		defaults: {
			model: flickr.Models.Photo
		},
		model: flickr.Models.Photo,
		url: 'http://api.flickr.com/services/feeds/photos_public.gne?tags=potato&tagmode=any&format=json&jsoncallback=?',
		parse: function (response) {
			return response.items;
		},
		// The function below is an override to ensure it triggers handlers on reset
		reset: function (models, options) {
			models  || (models = []);
			options || (options = {});
			for (var i = 0, l = this.models.length; i < l; i++) {
				this._removeReference(this.models[i]);
				this.models[i].trigger('remove', this.models[i], this);
			}
			this._reset();
			this.add(models, _.extend({silent: true}, options));
			if (!options.silent) {
				this.trigger('reset', this, options);
			}
			return this;
		}
	});

	/* 
	 * Photo model view
	 */
	flickr.Views.Photo = Backbone.View.extend ({
		tagName: 'li',
		events: {
			'click .thumbnail, span.title': 'showSingle',
			'click span.author': 'showAuthor',
			'click span.photo': 'showPhoto'
		},
		photoTemplate: template ('photoTemplate'),
		initialize: function () {
			_.bindAll (this, 'render', 'showSingle', 'showAuthor', 'showPhoto');
			this.model.bind ('change', this.render, this); // not necessary now, but just in case :)
			this.model.bind ('remove', this.unrender, this);
		},
		render: function () {
			$(this.el).html (this.photoTemplate (this.model.toJSON ()));
			return this;
		},
		unrender: function () {
			$(this.el).remove ();
		},
		showSingle: function () {
			app.navigate ("show/" + this.model.id, { trigger: true });
		},
		showAuthor: function () {
			//--- Go to the author on Flickr
			this.returnValue = false;
			window.open ('http://www.flickr.com/photos/' + this.model.get ('author_id'));
		},
		showPhoto: function () {
			//--- Go to the photo on Flickr
			this.returnValue = false;
			window.open (this.model.get ('link'));
		}
	});

	/*
	 * PhotoSingle model view
	 */
	flickr.Views.PhotoSingle = Backbone.View.extend ({
		el: $('#photoSingle'),
		events: {
			'click img, span.title': 'showPhoto',
			'click span.author': 'showAuthor',
			'click span.photo': 'showPhoto'
		},
		photoSingleTemplate: template ('photoSingleTemplate'),
		initialize: function () {
			_.bindAll (this, 'render', 'showAuthor', 'showPhoto');
			this.model.bind ('change', this.render); // not necessary now, but just in case :)
			this.render ();
		},
		render: function () {
			if ($(this.el).html ()) {
				$(this.el).html (this.photoSingleTemplate (this.model.toJSON ()));
				return this; // don't re-render
			}
			$(this.el).append (this.photoSingleTemplate (this.model.toJSON ()));
			document.title = this.model.get ('title');
			return this;
		},
		showAuthor: function () {
			//--- Go to the author on Flickr
			this.returnValue = false;
			window.open ('http://www.flickr.com/photos/' + this.model.get ('author_id'));
		},
		showPhoto: function () {
			//--- Go to the photo on Flickr
			this.returnValue = false;
			window.open (this.model.get ('link'));
		}
	});

	/* 
	 * Photo collection view
	 */
	flickr.Views.Album = Backbone.View.extend ({
		el: $('body'),
		events: {
			'click #search': 'reloadPhotos',
			'keyup #searchText': 'enterKey'
		},
		initialize: function (prop) {
			_.bindAll (this, 'render', 'appendPhoto', 'loadPhotos', 'reloadPhotos');
			this.collection = new flickr.Collections.Album ();
			this.collection.bind ('add', this.appendPhoto);
			this.render (prop);
		},
		render: function (prop) {
			prop = (typeof prop !== "object") ? {} : prop;
			if ($('#album').length) {
				return; // don't re-render
			}
			$(this.el).append ("<ul id='album'" + (prop.hidden ? " style='display: none;'" : "") + "><li>Find: <input type='text' name='searchText' id='searchText' value='potato' /> <button id='search'>Search Again</button> <img src='img/indicator.gif' align='absmiddle' /></li></ul>");
			return this;
		},
		appendPhoto: function (photo) {
			this.collection.push (photo);
			var photoView = new flickr.Views.Photo ({
				model: photo
			});
			$('ul', this.el).append (photoView.render ().el);
		},
		loadPhotos: function (loadId) {
			this.collection.fetch ({
				add: true,
				loadId: loadId,
				success: function (model, response, options) {
					var i = 0;
					_(model.models).each (function (photo) {
						var pubDate = new Date (photo.get ('published'));
						var pubDateExt = ((pubDate == 1) || (pubDate == 21) ? 'st' : ((pubDate == 2) || (pubDate == 22) ? 'nd' : ((pubDate == 3) || (pubDate == 23) ? 'rd' : 'th')));
						var pubHour = (pubDate.getHours () < 10 ? '0' + pubDate.getHours () : pubDate.getHours ());
						var monthNames = new Array ("Jan", "Feb", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
						photo.set ('_id', i);
						photo.set ('published', pubDate.getDate () + pubDateExt + ' ' + monthNames[pubDate.getMonth () - 1] + ' ' + pubDate.getFullYear () + ' at ' + pubHour + ':' + pubDate.getMinutes ());
						photo.set ('tags', photo.get ('tags').split (/ /g).map (function (a) { return '<a href="http://www.flickr.com/photos/tags/' + a + '/" target="_blank">' + a + '</a>'; }).join (' &middot; '));
						i++;
					}, this);
					if (options.loadId) {
						try {
							window.singlePhoto = new flickr.Views.PhotoSingle ({
								model: window.album.collection._byId[options.loadId]
							});
							$('#album').hide ();
						} catch (e) {
							alert ('Could not find that photo. Please choose another.');
							$('#album').show ();
						}
					}
					$('ul li:first-child img').css ('display', 'none');
				}
			});
		},
		reloadPhotos: function () {
			// Reset (note: we have overwritten this function)
			$('ul li:first-child img').css ('display', '');
			this.collection.reset ();
			// Reload (** ugly hack **)
			this.collection.url = 'http://api.flickr.com/services/feeds/photos_public.gne?tags=' + $('#searchText')[0].value + '&tagmode=any&format=json&jsoncallback=?';
			this.loadPhotos ();
		},
		enterKey: function (ev) {
			var key = (ev.which ? ev.which : ev.keyCode);
			if (key == 13) {
				this.returnValue = false;
				$('#search').trigger ('click');
			}
		}
	});

	app = new flickr.Router;
	Backbone.history.start();

}) (jQuery);