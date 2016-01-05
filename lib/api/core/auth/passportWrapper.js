var
  q = require('q'),
  passport = require('passport'),
  BadRequestError = require('../errors/badRequestError'),
  UnauthorizedError = require('../errors/unauthorizedError'),
  InternalError = require('../errors/internalError');

module.exports = function PassportWrapper (kuzzle) {

  this.authenticate = function(request, strategy) {
    var
      deferred = q.defer(),
      error;

    try {
      if (!passport._strategy(strategy)) {
        return q.reject(new BadRequestError('Unknown authentication strategy "' + strategy + '"'));
      }
      passport.authenticate(strategy, function(err, user, info) {
        kuzzle.pluginsManager.trigger('log:silly', 'Authenticate Info : ' + info);
        if (err !== null) {
          deferred.reject(err);
        }
        else if (user === false) {
          error = new UnauthorizedError(info.message);
          error.details = {
            subCode: error.subCodes.AuthenticationError
          };
          deferred.reject(error);
        }
        else {
          deferred.resolve(user);
        }
      })(request);
    } catch (err) {
      deferred.reject(new InternalError(err));
    }
    return deferred.promise;
  };

  kuzzle.pluginsManager.trigger('auth:loadStrategies', passport);

};