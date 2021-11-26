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
@click.option('-s', '--solo_node', type=bool, 	default=True, help="avoid IPFS and just run checks locally")
def run(**options):
	shell('docker stack rm '+ stack_name)

	cnf = 'demonitor/config.aml'
	if not os.path.isfile(cnf):
		shutil.copyfile('demonitor/config_example.aml', cnf)

	subprocess.check_call(
		shlex.split('docker build -t  "koo5/checker"  -f "checker/Dockerfile" .'))

	#subprocess.check_call(
	#	shlex.split('docker build -t  "koo5/echo"  -f "./Dockerfile" .'),
	#	cwd='echo')

	subprocess.check_call(
		shlex.split('docker build -t  "koo5/karma"  -f "karma/Dockerfile" .'))
		
	subprocess.check_call(
		shlex.split('docker build -t  "koo5/alertmanager"  -f "./Dockerfile" .'),
		cwd='alertmanager')
		
	if options['solo_node']:
		subprocess.check_call(
			shlex.split('docker build -t  "koo5/solomonitor"  -f "solomonitor/Dockerfile" .'))
	else:
		subprocess.check_call(
			shlex.split('docker build -t  "koo5/demonitor"  -f "demonitor/Dockerfile" .'))

	while True:
		cmdxxx = "docker network ls | grep " + stack_name
		p = subprocess.run(cmdxxx, shell=True, stdout=subprocess.PIPE)
		print(cmdxxx + ': ' + str(p.returncode) + ':')
		print(p.stdout)
		if p.returncode:
			break
		time.sleep(1)

	shell('docker stack deploy --prune --compose-file ' + generate_stack_file(options) + ' ' + stack_name)
	shell('docker stack ps ' + stack_name + ' --no-trunc')
	shell('./follow_logs.sh ' + stack_name)



def generate_stack_file(options):
	with open('docker_stack_template.yml') as file_in:
		src = yaml.load(file_in, Loader=yaml.FullLoader)
		fn = 'docker_stack_tweaked.yml'
	with open(fn, 'w') as file_out:
		yaml.dump(tweaked_services(src, options), file_out)
	return fn


def tweaked_services(src, options):
	res = deepcopy(src)
	services = res['services']
	if options['solo_node']:
		del services['demonitor']
		del services['ipfs']
	else:
		del services['solomonitor']
	return res



def shell(cmd):
	print('>'+cmd)
	r = os.system(cmd)
	if r != 0:
		exit(r)



if __name__ == '__main__':
    run()
