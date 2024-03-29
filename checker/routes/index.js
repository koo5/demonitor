const utils = require('@koo5/utils');
var express = require('express');
var router = express.Router();


router.post('/check', async function (req, res, next)
{
	const task = req.body;
	console.log(`do_task(${utils.s(task)})`);
	res.setTimeout(60000 + task.interval);
	var ok = false;
	var error;
	var result;

	if (task.type == 'chat')
	{
		try
		{
			const timeout = task.timeout || 10 * 60000;
			result = await utils.post(
				task.target + '/chat',
				{
					"type": "sbe",
					"current_state": []
				},
				{timeout, user:check.http_basicauth_user,pass:http_basicauth_pass});

			console.log(utils.ss(result));
			result = {status: result.status, data: result.body}
			//console.log(utils.s(result));
			if (result.status == 200 && result.data.status != 'error')
				ok = true;
		} catch (e)
		{
			/*console.log('error');
			console.log(utils.ss(e));
			console.log(utils.ss(e.code));
			console.log(utils.ss(e.options));*/
			error = e;
		}
	}

	res.send({ok, check: task, unix_ts_ms: Date.now(), result: utils.ss(result), error: utils.ss(error)});
});



module.exports = router;
