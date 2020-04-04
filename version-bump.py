#!/usr/bin/python3
import os, json, argparse, subprocess, uuid
from enum import Enum

class BumpType(Enum):
  PATCH = "patch"
  MINOR = "minor"
  MAJOR = "major"

parser = argparse.ArgumentParser(description='Automate version bumping and release.')
parser.add_argument('--bump', '-b', choices=[b.value for b in BumpType], 
  default=BumpType.PATCH.value)
parser.add_argument('--dryrun', '-y', action='store_true')
parser.add_argument('--notag', '-nt', action='store_true')
parser.add_argument('--push', '-p', action='store_true')
parser.add_argument('--publish', '-pub', action='store_true')
parser.add_argument('--version', '-v', help='manually specified version (overrides --bump)')
parser.add_argument('--packagejson', '-o', help='target package.json to modify', default='package.json')

def main(args):
  if not args.dryrun:
    ensure_package_has_no_changes()
  version = args.version if args.version else get_bumped_version(args.bump, args.packagejson)
  set_package_version(version, args.dryrun, args.packagejson)
  bump_commit(args.dryrun)
  if not args.notag:
    tag(version, args.dryrun)
  if args.push:
    push(args.dryrun)
  if args.publish:
    publish(args.dryrun)
  

def get_bumped_version(bumpType, packagejson):
  with open(packagejson,'r') as f:
    package = json.load(f)
    [major, minor, patch] = map(int,package['version'].split('.'))
    if bumpType == BumpType.MAJOR.value:
      major += 1
    elif bumpType == BumpType.MINOR.value:
      minor += 1
    elif bumpType == BumpType.PATCH.value:
      patch += 1
    return "{0}.{1}.{2}".format(major, minor, patch)

def set_package_version(version, dryrun, packagejson):
  with open(packagejson,'r') as f:
    package = json.load(f)
    package['version'] = version
  tempfile = os.path.join(os.path.dirname(packagejson), str(uuid.uuid4()))
  if dryrun:
    print('updated package.json to {0}\npackage.json dump:\n{1}'
      .format(version, json.dumps(package, indent=2)))
  else:
    with open(tempfile, 'w') as f:
        json.dump(package, f, indent=2)
        # add a newline for consistency with normal editors 
        # (which may automatically add it)
        f.write('\n')
    os.replace(tempfile, packagejson)

def ensure_package_has_no_changes():
  output = subprocess.check_output(['git','status','--porcelain'], universal_newlines=True)
  if output and len(output) > 0:
    raise Exception('Commit or stash your changes before bumping the version' + '\n\n' + output)

def bump_commit(dryrun=True):
  args = [
    'git', 'commit',
    '--message', 'automated version bump', 
    '--only', 'package.json',
  ]
  if dryrun:
    args.append('--porcelain')
  try:
    subprocess.check_output(args, universal_newlines=True)
  except subprocess.CalledProcessError as e:
    if dryrun:
      print('git commit', pprint_args(args[2:]) + '\n' + e.output)
    else:
      raise Exception('git commit ' + pprint_args(args[2:]) + '\n' + e.output)

def tag(version, dryrun=True):
  args = ['git', 'tag', '-a', 'v{0}'.format(version), '-m', 'release']
  if dryrun:
    print('git tag', pprint_args(args[2:]))
  else:
    subprocess.check_call(args)

def push(dryrun=True):
  args = ['git', 'push']
  if dryrun:
    print('git push', pprint_args(args[2:]))
  else:
    subprocess.check_call(args)
  
def publish(dryrun=True):
  args = ['yarn', 'vs-publish']
  if dryrun:
    print('yarn vs-publish', pprint_args(args[2:]))
  else:
    subprocess.check_call(args)

def pprint_args(args):
  return ' '.join(
    map(lambda p: '"'+p+'"' if p[0] != '-' else p, args)
  )

if __name__ == '__main__':
  main(parser.parse_args())
