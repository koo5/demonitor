#!/usr/bin/env python3


try:
	import click
	import yaml
except:
	print('please install:\npython3 -m pip install --user -U click pyyaml')
	exit(1)

import os,subprocess,time,shlex,sys,shutil
from copy import deepcopy


os.chdir(os.path.dirname(sys.argv[0]))


stack_name = 'damk'

@click.command()
def run():
	shell('docker stack rm '+ stack_name)

	cnf = 'demonitor/config.aml'
	if not os.path.isfile(cnf):
		shutil.copyfile('demonitor/config_example.aml', cnf)

	subprocess.check_call(
		shlex.split('docker build -t  "koo5/echo"  -f "./Dockerfile" .'),
		cwd='echo')

	subprocess.check_call(
		shlex.split('docker build -t  "koo5/configurable_karma"  -f "./Dockerfile" .'),
		cwd='configurable_karma')
	subprocess.check_call(
		shlex.split('docker build -t  "koo5/configurable_alertmanager"  -f "./Dockerfile" .'),
		cwd='alertmanager')
	subprocess.check_call(
		shlex.split('docker build -t  "koo5/demonitor"  -f "./Dockerfile" .'),
		cwd='demonitor')

	while True:
		cmdxxx = "docker network ls | grep " + stack_name
		p = subprocess.run(cmdxxx, shell=True, stdout=subprocess.PIPE)
		print(cmdxxx + ': ' + str(p.returncode) + ':')
		print(p.stdout)
		if p.returncode:
			break
		time.sleep(1)

	shell('docker stack deploy --prune --compose-file stack.yml ' + stack_name)

	shell('./follow_logs.sh ' + stack_name)


def shell(cmd):
	print('>'+cmd)
	r = os.system(cmd)
	if r != 0:
		exit(r)



if __name__ == '__main__':
    run()
