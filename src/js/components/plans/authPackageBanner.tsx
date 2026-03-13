import React from 'react';
import { useTranslation } from 'react-i18next';

const HELP_ARTICLE_URL =
  'https://help.salesforce.com/s/articleView?id=005228017&type=1';

const AuthPackageBanner = () => {
  const { t } = useTranslation();
  const packageVersionId = window.GLOBALS.AUTH_PACKAGE_VERSION_ID;

  if (!packageVersionId) {
    return null;
  }

  const productionUrl = `https://login.salesforce.com/packaging/installPackage.apexp?p0=${packageVersionId}`;
  const sandboxUrl = `https://test.salesforce.com/packaging/installPackage.apexp?p0=${packageVersionId}`;

  return (
    <div
      className="slds-notify slds-notify_alert slds-alert_warning"
      role="alert"
      style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
      }}
    >
      <p>
        {t('authPackageExplanation')}{' '}
        <a
          href={HELP_ARTICLE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('authPackageLearnMore')}
        </a>
      </p>
      <p style={{ marginTop: '0.25rem' }}>
        <span>{t('authPackageBanner')}</span>{' '}
        <a
          href={productionUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 700 }}
        >
          {t('authPackageInstallProduction')}
        </a>
        {' | '}
        <a
          href={sandboxUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 700 }}
        >
          {t('authPackageInstallSandbox')}
        </a>
      </p>
    </div>
  );
};

export default AuthPackageBanner;
