plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Set by .github/workflows/build-tv-apk.yml. The signing key itself never enters the repo:
// CI decodes it from a secret into a temp file and passes the path in TV_KEYSTORE_FILE.
val tvKeystoreFile: String? = System.getenv("TV_KEYSTORE_FILE")?.takeIf { it.isNotBlank() }
val tvVersionCode: Int = System.getenv("VERSION_CODE")?.trim()?.toIntOrNull() ?: 1

android {
    namespace = "com.maverick.boardgames.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.maverick.boardgames.tv"
        minSdk = 22
        targetSdk = 34
        versionCode = tvVersionCode
        versionName = "1.$tvVersionCode"
    }

    signingConfigs {
        create("release") {
            storeFile = tvKeystoreFile?.let { file(it) }
            storePassword = System.getenv("TV_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("TV_KEY_ALIAS")
            keyPassword = System.getenv("TV_KEYSTORE_PASSWORD") // the store and the key share one password
            storeType = "pkcs12"
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (tvKeystoreFile != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
