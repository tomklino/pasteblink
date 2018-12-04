#!/usr/bin/python

import sys, re, json
from subprocess import call, check_output
from argparse import ArgumentParser

def tagLatestWith(project_link, new_tag):
    gcloud_tag_latest_command = [
        "gcloud", "-q",
        "container",
        "images",
        "add-tag",
        project_link + ":latest",
        project_link + ":" + new_tag
    ]

    return call(gcloud_tag_latest_command) == 0

def getLastTagNumber(project_link):
    query_gcloud_command = [
        "gcloud",
        "container",
        "images",
        "list-tags",
        project_link,
        "--format=json"
    ]

    images = json.loads(check_output(query_gcloud_command))

    max_v_found = None
    for image in images:
        for tag in image['tags']:
            if re.match('^v\d+$', tag) != None:
                version_number = int(re.sub('v', '', tag))
                if version_number > max_v_found:
                    max_v_found = version_number
    return max_v_found

def gcloudBuild(project_link, project_name, path_to_config_yml):
    gcloud_build_command = [
        "gcloud",
        "builds",
        "submit",
        "--project=" + project_name,
        "--config", path_to_config_yml,
        "."
    ]

    if(call(gcloud_build_command) != 0):
        print "build failed"
        return False

    next_version_number = getLastTagNumber(project_link) + 1
    version_tag = "v" + str(next_version_number)

    if tagLatestWith(project_link, version_tag):
        print "Done. Build tagged with " + version_tag
        return True
    else:
        print "Build done - but failed to tag"
        return False

def main():
    parser = ArgumentParser()
    parser.add_argument('--project-link', type=str, required=True)
    parser.add_argument('--project-name', type=str, required=True)
    parser.add_argument('--config', type=str, required=True)
    args = parser.parse_args()

    project_link = args.project_link
    project_name = args.project_name
    path_to_config_yml = args.config

    if gcloudBuild(project_link, project_name, path_to_config_yml):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
