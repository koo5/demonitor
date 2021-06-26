const got = require('got');
const cycle = require('./cycle')


async function post(url, data, config)
{
	const timeout = config.timeout;
	response = await got(url, {
		json: data,
		responseType: 'json',
		method: 'POST',
		timeout: config.timeout,
		retry: {methods:['POST']},
		username: config.user,
		password: config.pass,

	});
	return response;
}

function s(x)
{
	return JSON.stringify(cycle.decycle(x));
}

function ss(x)
{
	return JSON.stringify(cycle.decycle(x), null, ' ');
}


module.exports = {post, s, ss};
