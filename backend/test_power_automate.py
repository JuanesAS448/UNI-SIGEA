"""Prueba controlada con mocks. No llama al flujo real ni imprime secretos.

Desde backend/: python -B test_power_automate.py
"""
import os
import sys


if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line([
        sys.argv[0], 'test', 'documental.tests', '--noinput', *sys.argv[1:],
    ])
