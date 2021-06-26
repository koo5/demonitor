var createError = require('http-errors');
var express = require('express');
var logger = require('morgan');

var indexRouter = require('./routes/index');


var app = express();
/*  app.setTimeout(60000*60, (e) => {
  console.log('socket timeout:')
  console.log(e)
})*/


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/', indexRouter);



app.use(function(req, res, next) {
  next(createError(404));
});


app.use(function(err, req, res, next) {
  res.status(err.status || 500);
});


module.exports = app;
