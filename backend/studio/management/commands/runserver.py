from django.contrib.staticfiles.management.commands.runserver import Command as StaticFilesRunserver


class Command(StaticFilesRunserver):
    """Use this project's local port; retain Django's normal reload and CLI options."""

    default_port = '8002'
