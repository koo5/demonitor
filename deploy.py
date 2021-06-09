#!/usr/bin/env python3


try:
	import click
	import yaml
except:
	print('please install:\npython3 -m pip install --user -U click pyyaml')
	exit(1)

import os,subprocess,time,shlex,sys
from copy import deepcopy


os.chdir(os.path.dirname(sys.argv[0]))


@click.command()
def run():
	shell('docker stack rm demonitor_alertmanager_karma')
	
	cnf = 'demonitor/config.aml'
	if !os.path.isfile(cnf):
		shutil.copyfile('demonitor/config_example.aml', cnf)
	
	subprocess.check_call(
		shlex.split('docker build -t  "koo5/configurable_karma"  -f "./Dockerfile" .'), 
		cwd='configurable_karma')
	subprocess.check_call(
		shlex.split('docker build -t  "koo5/demonitor"  -f "./Dockerfile" .'), 
		cwd='demonitor')
	
	while True:
		cmdxxx = "docker network ls | grep demonitor_alertmanager_karma"
		p = subprocess.run(cmdxxx, shell=True, stdout=subprocess.PIPE)
		print(cmdxxx + ': ' + str(p.returncode) + ':')
		print(p.stdout)
		if p.returncode:
			break
		time.sleep(1)

	shell('docker stack deploy --prune --compose-file stack.yml demonitor_alertmanager_karma')

	shell('./follow_logs.sh')


def shell(cmd):
	print('>'+cmd)
	r = os.system(cmd)
	if r != 0:
		exit(r)



if __name__ == '__main__':
    run()