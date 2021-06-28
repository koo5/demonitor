const axios = require('axios');
const axiosRetry = require('axios-retry');
axiosRetry(axios, { retries: 5, retryDelay: axiosRetry.exponentialDelay });
const cycle = require('./cycle')

async function post(url, data, config)
{
	const timeout = config.timeout || 10000;
	const source = axios.CancelToken.source();
	let response = null;
	setTimeout(() =>
	{
		if (response === null)
		{
			source.cancel(`timeout of ${timeout}ms`);
		}
	}, timeout);
	response = await axios.post(url, data, {cancelToken: source.token});
	return response;
}


/*
async function post(url, data, config)
{
	response = await got(url, {
		json: data,
		responseType: 'json',
		method: 'POST',
		timeout: config.timeout,
		retry: {methods:['POST']},
		username: config.user,
		password: config.pass,
		resolveBodyOnly: true,
	});
	return response;
}
*/
function s(x)
{
	return JSON.stringify(cycle.decycle(x));
}

function ss(x)
{
	return JSON.stringify(cycle.decycle(x), null, ' ');
}


module.exports = {post, s, ss};
