var registry = require('etcd-registry');
var noop = function() {};

module.exports = function(services, opts, server, cb) {
	if (!cb) cb = noop;
	if (typeof opts === 'string' || Array.isArray(opts)) opts = {name:opts};
	if (typeof services === 'string') services = registry(services);

	var port = typeof server === 'number' ? server : server.address().port;
	var server = typeof server === 'number' ? null : server;
	var names = [].concat(opts.name || opts.names);

	var loop = function(err, service) {
		if (err) return cb(err);
		if (!names.length) return cb(null, service);
		services.join(names.shift(), {port:port}, loop);
	};

	loop();

	var pexit = process.exit;

	var exit = function(timeout) {
		if (timeout) return setTimeout(pexit, timeout).unref();
		pexit();
	};

	if (opts.slack === undefined) opts.slack = 10000;
	if (opts.wait === undefined) opts.wait = 2000;

	process.exit = function(code) { // a bit hackish but we want to intercept process exit and do async stuff
		services.leave(function() {
			pexit(code);
		});
	};

	process.on('SIGTERM', function() {
		if (!opts.wait && !opts.slack) return process.exit();
		setTimeout(function() {
			services.leave(function(err) {
				if (err) return exit();
				exit(opts.slack);
			});
		}, opts.wait);
	});

	process.on('SIGINT', function() {
		services.leave(function() {
			exit();
		});
	});

	return server;
};
