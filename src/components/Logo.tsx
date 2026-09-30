import React from 'react';
import { Image, View, StyleSheet, ImageStyle, ViewStyle } from 'react-native';

interface LogoProps {
    size?: number;
    style?: ViewStyle;
}

const Logo: React.FC<LogoProps> = ({ size = 200, style }) => {
    return (
        <View style={[styles.container, style]}>
            <Image
                source={require('../../assets/images/logo.png')}
                style={[styles.image, { width: size, height: size * 0.5 }] as ImageStyle}
                resizeMode="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 0,
    },
    image: {
        maxWidth: '100%',
    },
});

export default Logo;
