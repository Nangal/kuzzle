'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  HttpResponse = require('../../../../lib/api/core/entryPoints/httpResponse'),
  Router = require('../../../../lib/api/core/httpRouter'),
  Request = require('kuzzle-common-objects').Request;

describe('core/httpRouter', () => {
  let
    router,
    handler,
    kuzzleMock,
    callback,
    rq;

  beforeEach(() => {
    kuzzleMock = new KuzzleMock();
    router = new Router(kuzzleMock);
    handler = sinon.stub();
    callback = sinon.stub();
    rq = {
      requestId: 'requestId',
      url: '',
      method: '',
      headers: {},
      content: ''
    };
  });

  describe('#adding routes', () => {
    it('should add a POST route when asked to', () => {
      router.post('/foo/bar', handler);
      should(router.routes.POST.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a GET route when asked to', () => {
      router.get('/foo/bar', handler);
      should(router.routes.GET.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a PUT route when asked to', () => {
      router.put('/foo/bar', handler);
      should(router.routes.PUT.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should add a DELETE route when asked to', () => {
      router.delete('/foo/bar', handler);
      should(router.routes.DELETE.subparts.foo.subparts.bar.handler).be.eql(handler);
    });

    it('should raise an internal error when trying to add a duplicate', () => {
      router.post('/foo/bar', handler);
      should(function () { router.post('/foo/bar', handler); }).throw(InternalError);
    });
  });

  describe('#routing requests', () => {
    it('should invoke the registered handler on a known route', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0]).be.instanceOf(Request);
    });

    it('should amend the request object if a body is found in the content', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0].id).match(rq.requestId);
      should(handler.firstCall.args[0].input.body).match({foo: 'bar'});
      should(handler.firstCall.args[0].input.args['content-type']).eql('application/json');
    });

    it('should return dynamic values for parametric routes', () => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0].id).match(rq.requestId);
      should(handler.firstCall.args[0].input.body).match({foo: 'bar'});
      should(handler.firstCall.args[0].input.args['content-type']).eql('application/json');
      should(handler.firstCall.args[0].input.args.bar).eql('hello');
      should(handler.firstCall.args[0].input.args.baz).eql('world');
    });

    it('should unnescape dynamic values for parametric routes', () => {
      router.post('/foo/:bar/:baz', handler);

      rq.url = '/foo/hello/%25world';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=utf-8';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.calledOnce).be.true();
      should(handler.firstCall.args[0].id).match(rq.requestId);
      should(handler.firstCall.args[0].input.body).match({foo: 'bar'});
      should(handler.firstCall.args[0].input.args['content-type']).eql('application/json; charset=utf-8');
      should(handler.firstCall.args[0].input.args.bar).eql('hello');
      should(handler.firstCall.args[0].input.args.baz).eql('%world');
    });

    it('should trigger an event when handling an OPTIONS HTTP method', done => {
      rq.url = '/';
      rq.method = 'OPTIONS';
      rq.headers = {
        'content-type': 'application/json',
        foo: 'bar'
      };

      router.route(rq, callback);

      setTimeout(() => {
        should(handler.called).be.false();
        should(callback.calledOnce).be.true();
        should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
        should(callback.firstCall.args[0]).match({
          id: rq.requestId,
          status: 200
        });

        should(callback.firstCall.args[0]).have.property('content');
        should(callback.firstCall.args[0].content.toJSON()).match({
          raw: false,
          requestId: rq.requestId,
          content: {
            status: 200,
            error: null,
            requestId: 'requestId',
            result: {}
          },
          headers: {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
          }
        });

        should(kuzzleMock.pluginsManager.trigger.calledOnce).be.true();
        should(kuzzleMock.pluginsManager.trigger.calledWith('http:options', sinon.match.instanceOf(Request))).be.true();
        should(kuzzleMock.pluginsManager.trigger.firstCall.args[1].input.args.foo).eql('bar');
        done();
      }, 20);
    });

    it('should return an error if the HTTP method is unknown', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'FOOBAR';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        status: 400
      });

      should(callback.firstCall.args[0]).have.property('content');
      should(callback.firstCall.args[0].content.toJSON()).match({
        raw: false,
        requestId: rq.requestId,
        content: {
          status: 400,
          error: {
            status: 400,
            message: 'Unrecognized HTTP method FOOBAR'
          },
          requestId: 'requestId',
          result: null
        },
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
        }
      });
    });

    it('should return an error if unable to parse the incoming JSON content', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{bad JSON syntax}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        status: 400
      });

      should(callback.firstCall.args[0]).have.property('content');
      should(callback.firstCall.args[0].content.toJSON()).match({
        raw: false,
        requestId: rq.requestId,
        content: {
          status: 400,
          error: {
            status: 400,
            message: 'Unable to convert HTTP body to JSON'
          },
          requestId: 'requestId',
          result: null
        },
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
        }
      });
    });

    it('should return an error if the content-type is not JSON', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/foobar';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        status: 400
      });

      should(callback.firstCall.args[0]).have.property('content');
      should(callback.firstCall.args[0].content.toJSON()).match({
        raw: false,
        requestId: rq.requestId,
        content: {
          status: 400,
          error: {
            status: 400,
            message: 'Invalid request content-type. Expected "application/json", got: "application/foobar"'
          },
          requestId: 'requestId',
          result: null
        },
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
        }
      });
    });

    it('should send an error if the charset is not utf-8', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'POST';
      rq.headers['content-type'] = 'application/json; charset=iso8859-1';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        status: 400
      });

      should(callback.firstCall.args[0]).have.property('content');
      should(callback.firstCall.args[0].content.toJSON()).match({
        raw: false,
        requestId: rq.requestId,
        content: {
          status: 400,
          error: {
            status: 400,
            message: 'Invalid request charset. Expected "utf-8", got: "iso8859-1"'
          },
          requestId: 'requestId',
          result: null
        },
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
        }
      });
    });

    it('should return an error if the route does not exist', () => {
      router.post('/foo/bar', handler);

      rq.url = '/foo/bar';
      rq.method = 'PUT';
      rq.headers['content-type'] = 'application/json';
      rq.content = '{"foo": "bar"}';

      router.route(rq, callback);
      should(handler.called).be.false();
      should(callback.calledOnce).be.true();
      should(callback.firstCall.args[0]).be.instanceOf(HttpResponse);
      should(callback.firstCall.args[0]).match({
        id: rq.requestId,
        status: 404
      });

      should(callback.firstCall.args[0]).have.property('content');
      should(callback.firstCall.args[0].content.toJSON()).match({
        raw: false,
        requestId: rq.requestId,
        content: {
          status: 404,
          error: {
            status: 404,
            message: 'API URL not found: /foo/bar'
          },
          requestId: 'requestId',
          result: null
        },
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
        }
      });
    });
  });
});
