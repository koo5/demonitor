function get_checks(config)
{
	const r = [
		{node: 'dev', interval: 0.5*60000, type: 'chat', target: 'localhost:88', timeout: 0.5*60000},
		{node: 'dev', interval: 15*60000, type: 'chat', target: config.nodes.vmi1.url, timeout: 15*60000},
		{node: 'dev', interval: 16*60000, type: 'chat', target: config.nodes.azure.url, timeout: 15*60000},
		{node: 'azure', interval: 18*60000, type: 'chat', target: config.nodes.vmi1.url, timeout: 15*60000},
		{node: 'vmi1', interval: 18*60000, type: 'chat', target: config.nodes.azure.url, timeout: 15*60000},
	];
	r.forEach((i) =>
	{
		i.http_basicauth_user = config.nodes.http_basicauth_user;
		i.http_basicauth_pass = config.nodes.http_basicauth_pass;
	})
	return r;
}

module.exports = {get_checks};
