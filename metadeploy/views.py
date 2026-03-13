import sys

from django.conf import settings
from django.shortcuts import render
from sfdo_template_helpers.oauth2.salesforce.views import SalesforcePermissionsError

from config.settings.base import IP_RESTRICTED_MESSAGE

GENERIC_ERROR_MSG = "An internal error occurred while processing your request."

AUTH_PACKAGE_ERROR_MSG = (
    "Login failed. This is usually because the required authentication package "
    "has not been installed in your Salesforce org. Please install it using the "
    "links at the top of this page, then try logging in again. "
    "If you see a \"Missing feature: External Client Applications\" error when "
    "installing the package, your org needs the External Client Apps feature "
    "enabled — go to Setup and search for \"External Client App Manager\". "
    "If it doesn't appear, contact Salesforce Support to enable it."
)


def custom_permission_denied_view(request, exception):
    message = GENERIC_ERROR_MSG
    if isinstance(exception, SalesforcePermissionsError):
        message = str(exception)

    return render(
        request,
        "index.html",
        context={"JS_CONTEXT": {"error_message": message}},
        status=403,
    )


def _get_error_string(value):
    """Extract a searchable string from the exception value."""
    if value is None:
        return ""
    if value.args:
        return str(value.args[0]).lower()
    return str(value).lower()


def custom_500_view(request):
    message = GENERIC_ERROR_MSG
    value = sys.exc_info()[1]
    error_str = _get_error_string(value)

    if "ip restricted" in error_str:
        message = IP_RESTRICTED_MESSAGE
    elif settings.AUTH_PACKAGE_VERSION_ID:
        # When an auth package is configured, login failures are most likely
        # caused by the package not being installed in the subscriber org.
        message = AUTH_PACKAGE_ERROR_MSG

    return render(
        request,
        "index.html",
        context={"JS_CONTEXT": {"error_message": message}},
        status=500,
    )
