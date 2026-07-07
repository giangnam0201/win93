


const scriptsInEvents = {

	async Parentspacekey_Event1(runtime, localVars)
	{
		// Ecouter l'événement 'keydown' dans l'iframe
		window.onkeydown = function(e) {
		  if (e.code === 'Space') {
		    e.preventDefault();
		  }
		};
	}

};

self.C3.ScriptsInEvents = scriptsInEvents;

