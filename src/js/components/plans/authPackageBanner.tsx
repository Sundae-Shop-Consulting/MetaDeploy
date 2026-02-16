import Toast from '@salesforce/design-system-react/components/toast';
import ToastContainer from '@salesforce/design-system-react/components/toast/container';
import React, { Component } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';

type State = {
  isOpen: boolean;
};

class AuthPackageBanner extends Component<WithTranslation, State> {
  constructor(props: WithTranslation) {
    super(props);
    this.state = { isOpen: true };
  }

  closeToast = () => {
    this.setState({ isOpen: false });
  };

  render() {
    const { t } = this.props;
    const { isOpen } = this.state;
    const packageVersionId = window.GLOBALS.AUTH_PACKAGE_VERSION_ID;

    if (!isOpen || !packageVersionId) {
      return null;
    }

    const productionUrl = `https://login.salesforce.com/packaging/installPackage.apexp?p0=${packageVersionId}`;
    const sandboxUrl = `https://test.salesforce.com/packaging/installPackage.apexp?p0=${packageVersionId}`;

    return (
      <ToastContainer>
        <Toast
          labels={{
            heading: [
              t('authPackageBanner'),
              ' ',
              <a
                key="production"
                href={productionUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('authPackageInstallProduction')}
              </a>,
              ' | ',
              <a
                key="sandbox"
                href={sandboxUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('authPackageInstallSandbox')}
              </a>,
            ],
          }}
          variant="warning"
          onRequestClose={this.closeToast}
        />
      </ToastContainer>
    );
  }
}

export default withTranslation()(AuthPackageBanner);
